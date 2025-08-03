import { createWorker } from 'tesseract.js';

export interface TableRow {
  [key: string]: string;
}

export interface OCRResult {
  success: boolean;
  data: TableRow[];
  error?: string;
  confidence?: number;
}

export class OCRService {
  private worker: any;

  async initialize() {
    try {
      this.worker = await createWorker('eng+hin');
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzअआइईउऊऋएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहक्षत्रज्ञ।,:;/-()₹.+ ',
      });
      return true;
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      return false;
    }
  }

  async processImage(imageFile: File): Promise<OCRResult> {
    try {
      if (!this.worker) {
        await this.initialize();
      }

      const { data: { text, confidence } } = await this.worker.recognize(imageFile);
      
      // Process the extracted text into structured data
      const tableData = this.parseTextToTable(text);
      
      return {
        success: true,
        data: tableData,
        confidence: confidence
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'OCR processing failed'
      };
    }
  }

  private parseTextToTable(text: string): TableRow[] {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const tableData: TableRow[] = [];
    
    // Try to detect table structure and extract data
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.length === 0) continue;
      
      // Try different parsing strategies for Indian business records
      const rowData = this.parseLineToRow(cleanLine);
      if (Object.keys(rowData).length > 0) {
        tableData.push(rowData);
      }
    }
    
    return tableData;
  }

  private parseLineToRow(line: string): TableRow {
    const row: TableRow = {};
    
    // Pattern 1: Date | Item | Quantity | Rate | Amount
    const pattern1 = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\s*[|\s]\s*([^|\d₹]+)[|\s]\s*(\d+)\s*[|\s]\s*₹?(\d+(?:\.\d{2})?)\s*[|\s]\s*₹?(\d+(?:\.\d{2})?)/;
    const match1 = line.match(pattern1);
    
    if (match1) {
      row['Date'] = match1[1];
      row['Item'] = match1[2].trim();
      row['Quantity'] = match1[3];
      row['Rate'] = match1[4];
      row['Amount'] = match1[5];
      return row;
    }
    
    // Pattern 2: Simple format - Item followed by amount
    const pattern2 = /([^₹\d]+)\s*₹?(\d+(?:\.\d{2})?)/;
    const match2 = line.match(pattern2);
    
    if (match2) {
      row['Item'] = match2[1].trim();
      row['Amount'] = match2[2];
      return row;
    }
    
    // Pattern 3: Multiple columns separated by spaces or tabs
    const columns = line.split(/\s{2,}|\t/).filter(col => col.trim().length > 0);
    if (columns.length >= 2) {
      columns.forEach((col, index) => {
        const columnName = this.getColumnName(index, columns.length);
        row[columnName] = col.trim();
      });
      return row;
    }
    
    return {};
  }

  private getColumnName(index: number, totalColumns: number): string {
    const columnNames = [
      'Date', 'Item', 'Description', 'Quantity', 'Rate', 'Amount', 'Customer', 'Notes'
    ];
    
    if (totalColumns === 2) {
      return index === 0 ? 'Item' : 'Amount';
    } else if (totalColumns === 3) {
      const names = ['Item', 'Quantity', 'Amount'];
      return names[index] || `Column_${index + 1}`;
    } else if (totalColumns >= 4) {
      return columnNames[index] || `Column_${index + 1}`;
    }
    
    return `Column_${index + 1}`;
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
} 