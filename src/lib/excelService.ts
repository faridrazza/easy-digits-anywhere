import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { TableRow as DataRow } from './ocrService';

export interface ExcelOptions {
  sheetName?: string;
  fileName?: string;
  appendToExisting?: boolean;
  existingData?: DataRow[];
}

export class ExcelService {
  static generateExcelFile(
    data: DataRow[], 
    options: ExcelOptions = {}
  ): void {
    const {
      sheetName = 'Sheet1',
      fileName = 'register_data.xlsx',
      appendToExisting = false,
      existingData = []
    } = options;

    // Combine existing data with new data if appending
    const finalData = appendToExisting 
      ? [...existingData, ...data] 
      : data;

    if (finalData.length === 0) {
      throw new Error('No data to export');
    }

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(finalData);

    // Auto-size columns
    const columnWidths = this.calculateColumnWidths(finalData);
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate Excel file and trigger download
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array' 
    });
    
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, fileName);
  }

  static createExcelFromMultipleImages(
    imageResults: Array<{ filename: string; data: DataRow[] }>,
    options: ExcelOptions = {}
  ): void {
    const {
      fileName = 'combined_register_data.xlsx'
    } = options;

    const workbook = XLSX.utils.book_new();

    imageResults.forEach(({ filename, data }, index) => {
      if (data.length > 0) {
        const sheetName = filename.replace(/\.[^/.]+$/, "") || `Sheet${index + 1}`;
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        // Auto-size columns
        const columnWidths = this.calculateColumnWidths(data);
        worksheet['!cols'] = columnWidths;
        
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }
    });

    if (workbook.SheetNames.length === 0) {
      throw new Error('No valid data found in any image');
    }

    // Generate Excel file and trigger download
    const excelBuffer = XLSX.write(workbook, { 
      bookType: 'xlsx', 
      type: 'array' 
    });
    
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    saveAs(blob, fileName);
  }

  private static calculateColumnWidths(data: DataRow[]): Array<{ width: number }> {
    if (data.length === 0) return [];

    const headers = Object.keys(data[0]);
    const columnWidths: Array<{ width: number }> = [];

    headers.forEach(header => {
      let maxLength = header.length;
      
      data.forEach(row => {
        const cellValue = String(row[header] || '');
        if (cellValue.length > maxLength) {
          maxLength = cellValue.length;
        }
      });
      
      // Set minimum width of 10 and maximum of 50
      const width = Math.min(Math.max(maxLength + 2, 10), 50);
      columnWidths.push({ width });
    });

    return columnWidths;
  }

  static parseExcelFile(file: File): Promise<DataRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get the first sheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: ''
          });
          
          // Convert array format to object format
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as string[][];
          
          const tableData: DataRow[] = rows.map(row => {
            const rowObj: DataRow = {};
            headers.forEach((header, index) => {
              rowObj[header] = row[index] || '';
            });
            return rowObj;
          });
          
          resolve(tableData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read Excel file'));
      reader.readAsArrayBuffer(file);
    });
  }
} 