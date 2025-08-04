import { supabase } from '@/integrations/supabase/client';

interface AnalysisResult {
  insights: string[];
  suggestions: string[];
  summary: string;
}

interface FormulaResult {
  formula: string;
  description: string;
  result?: any;
}

export class AIService {
  // Analyze data and provide insights
  static analyzeData(data: { headers: string[]; rows: Array<Record<string, string>> }): AnalysisResult {
    const { headers, rows } = data;
    const insights: string[] = [];
    const suggestions: string[] = [];
    
    // Data completeness analysis
    const totalCells = rows.length * headers.length;
    const filledCells = rows.reduce((count, row) => {
      return count + headers.filter(header => row[header] && row[header].trim()).length;
    }, 0);
    const completeness = (filledCells / totalCells) * 100;
    
    insights.push(`Data completeness: ${completeness.toFixed(1)}% of cells contain data`);
    
    // Find numeric columns
    const numericColumns = headers.filter(header => {
      return rows.some(row => {
        const value = row[header];
        return value && !isNaN(Number(value.replace(/[,\s]/g, '')));
      });
    });
    
    if (numericColumns.length > 0) {
      insights.push(`Found ${numericColumns.length} numeric columns: ${numericColumns.join(', ')}`);
      suggestions.push('Consider adding sum/average calculations for numeric columns');
    }
    
    // Find duplicate rows
    const uniqueRows = new Set(rows.map(row => JSON.stringify(row)));
    const duplicates = rows.length - uniqueRows.size;
    if (duplicates > 0) {
      insights.push(`Found ${duplicates} duplicate rows`);
      suggestions.push('Consider removing duplicate entries for cleaner data');
    }
    
    // Find most diverse column
    const columnDiversity = headers.map(header => ({
      column: header,
      uniqueValues: new Set(rows.map(row => row[header]).filter(val => val && val.trim())).size
    }));
    const mostDiverse = columnDiversity.sort((a, b) => b.uniqueValues - a.uniqueValues)[0];
    
    if (mostDiverse) {
      insights.push(`Most diverse column: ${mostDiverse.column} with ${mostDiverse.uniqueValues} unique values`);
    }
    
    // Empty fields analysis
    const emptyFields = headers.map(header => ({
      column: header,
      emptyCount: rows.filter(row => !row[header] || !row[header].trim()).length
    })).filter(col => col.emptyCount > 0);
    
    if (emptyFields.length > 0) {
      const mostEmpty = emptyFields.sort((a, b) => b.emptyCount - a.emptyCount)[0];
      insights.push(`Column with most empty values: ${mostEmpty.column} (${mostEmpty.emptyCount} empty)`);
      suggestions.push('Consider data validation or default values for incomplete entries');
    }
    
    const summary = `Your dataset contains ${rows.length} rows and ${headers.length} columns with ${completeness.toFixed(1)}% data completeness. ${numericColumns.length > 0 ? `${numericColumns.length} columns contain numeric data suitable for calculations.` : 'No numeric columns detected for calculations.'} ${duplicates > 0 ? `${duplicates} duplicate rows were found.` : 'No duplicate rows detected.'}`;
    
    return { insights, suggestions, summary };
  }
  
  // Suggest formulas based on data
  static suggestFormulas(data: { headers: string[]; rows: Array<Record<string, string>> }): FormulaResult[] {
    const { headers, rows } = data;
    const formulas: FormulaResult[] = [];
    
    // Find numeric columns
    const numericColumns = headers.filter(header => {
      return rows.some(row => {
        const value = row[header];
        return value && !isNaN(Number(value.replace(/[,\s]/g, '')));
      });
    });
    
    numericColumns.forEach(column => {
      const values = rows
        .map(row => Number(row[column]?.replace(/[,\s]/g, '') || 0))
        .filter(val => !isNaN(val));
      
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const max = Math.max(...values);
        const min = Math.min(...values);
        
        formulas.push({
          formula: `SUM(${column})`,
          description: `Calculate total of all ${column} values`,
          result: sum
        });
        
        formulas.push({
          formula: `AVERAGE(${column})`,
          description: `Calculate average of ${column} values`,
          result: avg.toFixed(2)
        });
        
        formulas.push({
          formula: `MAX(${column})`,
          description: `Find maximum value in ${column}`,
          result: max
        });
        
        formulas.push({
          formula: `MIN(${column})`,
          description: `Find minimum value in ${column}`,
          result: min
        });
      }
    });
    
    // Suggest count formulas
    headers.forEach(column => {
      const nonEmptyCount = rows.filter(row => row[column] && row[column].trim()).length;
      formulas.push({
        formula: `COUNT(${column})`,
        description: `Count non-empty values in ${column}`,
        result: nonEmptyCount
      });
    });
    
    return formulas;
  }
  
  // Process natural language queries
  static processQuery(query: string, data: { headers: string[]; rows: Array<Record<string, string>> }): string {
    const lowerQuery = query.toLowerCase();
    const { headers, rows } = data;
    
    // Handle "how many" questions
    if (lowerQuery.includes('how many')) {
      if (lowerQuery.includes('row')) {
        return `Your data contains ${rows.length} rows.`;
      }
      if (lowerQuery.includes('column')) {
        return `Your data contains ${headers.length} columns: ${headers.join(', ')}.`;
      }
    }
    
    // Handle "what is" questions
    if (lowerQuery.includes('what is') || lowerQuery.includes('what are')) {
      const analysis = this.analyzeData(data);
      return analysis.summary;
    }
    
    // Handle column-specific questions
    const mentionedColumn = headers.find(header => 
      lowerQuery.includes(header.toLowerCase())
    );
    
    if (mentionedColumn) {
      const values = rows.map(row => row[mentionedColumn]).filter(val => val && val.trim());
      const uniqueValues = new Set(values);
      
      if (lowerQuery.includes('unique') || lowerQuery.includes('different')) {
        return `The ${mentionedColumn} column has ${uniqueValues.size} unique values: ${Array.from(uniqueValues).slice(0, 10).join(', ')}${uniqueValues.size > 10 ? '...' : ''}.`;
      }
      
      if (lowerQuery.includes('empty') || lowerQuery.includes('missing')) {
        const emptyCount = rows.length - values.length;
        return `The ${mentionedColumn} column has ${emptyCount} empty values out of ${rows.length} total rows.`;
      }
      
      // Check if it's numeric for calculations
      const numericValues = values.map(val => Number(val.replace(/[,\s]/g, ''))).filter(val => !isNaN(val));
      if (numericValues.length > 0 && (lowerQuery.includes('sum') || lowerQuery.includes('total'))) {
        const sum = numericValues.reduce((a, b) => a + b, 0);
        return `The sum of ${mentionedColumn} is ${sum}.`;
      }
      
      if (numericValues.length > 0 && lowerQuery.includes('average')) {
        const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
        return `The average of ${mentionedColumn} is ${avg.toFixed(2)}.`;
      }
    }
    
    // Handle formula requests
    if (lowerQuery.includes('formula') || lowerQuery.includes('calculate')) {
      const formulas = this.suggestFormulas(data);
      if (formulas.length > 0) {
        return `Here are some suggested formulas:\n${formulas.slice(0, 5).map(f => `• ${f.formula}: ${f.description}`).join('\n')}`;
      }
    }
    
    // Handle data analysis requests
    if (lowerQuery.includes('analyze') || lowerQuery.includes('insight')) {
      const analysis = this.analyzeData(data);
      return `**Data Analysis:**\n\n${analysis.summary}\n\n**Key Insights:**\n${analysis.insights.map(insight => `• ${insight}`).join('\n')}\n\n**Suggestions:**\n${analysis.suggestions.map(suggestion => `• ${suggestion}`).join('\n')}`;
    }
    
    // Default helpful response
    return `I can help you with your data! Here's what I can do:
    
• **Analyze your data** - Get insights about your ${rows.length} rows and ${headers.length} columns
• **Create formulas** - Add calculations for numeric columns
• **Answer questions** - Ask about specific columns: ${headers.join(', ')}
• **Data validation** - Check for duplicates, empty values, and data quality

Try asking: "Analyze my data", "How many unique values in [column name]?", or "Create a sum formula".`;
  }
  
  // Validate and clean data
  static validateData(data: { headers: string[]; rows: Array<Record<string, string>> }): {
    errors: string[];
    warnings: string[];
    suggestions: string[];
  } {
    const { headers, rows } = data;
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    // Check for empty headers
    const emptyHeaders = headers.filter(header => !header || !header.trim());
    if (emptyHeaders.length > 0) {
      errors.push(`Found ${emptyHeaders.length} empty column headers`);
    }
    
    // Check for duplicate headers
    const uniqueHeaders = new Set(headers);
    if (uniqueHeaders.size !== headers.length) {
      errors.push('Duplicate column headers found');
    }
    
    // Check for completely empty rows
    const emptyRows = rows.filter(row => 
      headers.every(header => !row[header] || !row[header].trim())
    );
    if (emptyRows.length > 0) {
      warnings.push(`Found ${emptyRows.length} completely empty rows`);
      suggestions.push('Consider removing empty rows to clean up your data');
    }
    
    // Check data consistency for each column
    headers.forEach(header => {
      const values = rows.map(row => row[header]).filter(val => val && val.trim());
      
      // Check if column appears to be numeric but has non-numeric values
      const numericValues = values.filter(val => !isNaN(Number(val.replace(/[,\s]/g, ''))));
      const nonNumericValues = values.filter(val => isNaN(Number(val.replace(/[,\s]/g, ''))));
      
      if (numericValues.length > values.length * 0.7 && nonNumericValues.length > 0) {
        warnings.push(`Column "${header}" appears mostly numeric but contains ${nonNumericValues.length} non-numeric values`);
        suggestions.push(`Consider validating data in "${header}" column for consistency`);
      }
    });
    
    return { errors, warnings, suggestions };
  }
}