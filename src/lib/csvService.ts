import { TableRow as DataRow } from './ocrService';

export class CSVService {
  static generateCSVFile(data: DataRow[], filename: string = 'register_data.csv'): void {
    if (data.length === 0) {
      throw new Error('No data to export');
    }

    // Get headers from first row
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    const csvContent = [
      // Header row
      headers.join(','),
      // Data rows
      ...data.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }

  static combineAndDownloadCSV(
    dataArray: Array<{ filename: string; data: DataRow[] }>, 
    filename: string = 'combined_register_data.csv'
  ): void {
    if (dataArray.length === 0) {
      throw new Error('No data to export');
    }

    // Combine all data with source filename
    const combinedData: DataRow[] = [];
    
    dataArray.forEach(({ filename: sourceFile, data }) => {
      data.forEach(row => {
        combinedData.push({
          'Source File': sourceFile,
          ...row
        });
      });
    });

    this.generateCSVFile(combinedData, filename);
  }
} 