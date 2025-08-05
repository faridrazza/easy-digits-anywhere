import * as React from "react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ChevronUp, 
  ChevronDown, 
  Filter, 
  Download,
  Grid3X3,
  Table as TableIcon,
  Save,
  X
} from "lucide-react";

interface TableData {
  headers: string[];
  rows: Array<Record<string, string>>;
}

interface EnhancedTableProps {
  data: TableData;
  onDataChange?: (data: TableData) => void;
  showSpreadsheetToggle?: boolean;
  className?: string;
}

export function EnhancedTable({ 
  data, 
  onDataChange, 
  showSpreadsheetToggle = false,
  className 
}: EnhancedTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'table' | 'spreadsheet'>('table');

  // Filter and sort data
  const processedData = React.useMemo(() => {
    let filtered = data.rows;

    // Apply filters
    Object.keys(filters).forEach(key => {
      const filterValue = filters[key];
      if (filterValue) {
        filtered = filtered.filter(row => 
          row[key]?.toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data.rows, filters, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const startEdit = (rowIndex: number, col: string) => {
    const actualRowIndex = data.rows.findIndex(row => row === processedData[rowIndex]);
    setEditingCell({ row: actualRowIndex, col });
    setEditValue(data.rows[actualRowIndex][col] || '');
  };

  const saveEdit = () => {
    if (!editingCell || !onDataChange) return;

    const newRows = [...data.rows];
    newRows[editingCell.row] = {
      ...newRows[editingCell.row],
      [editingCell.col]: editValue
    };

    onDataChange({
      ...data,
      rows: newRows
    });

    setEditingCell(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  if (viewMode === 'spreadsheet') {
    return (
      <div className={cn("border rounded-lg overflow-hidden", className)}>
        {/* Spreadsheet Header */}
        <div className="border-b bg-muted/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            <span className="font-medium">Spreadsheet View</span>
          </div>
          {showSpreadsheetToggle && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setViewMode('table')}
            >
              <TableIcon className="h-4 w-4 mr-2" />
              Table View
            </Button>
          )}
        </div>

        {/* Spreadsheet Grid */}
        <div className="overflow-auto max-h-[600px]">
          <div className="grid gap-0 border-collapse" style={{ gridTemplateColumns: `repeat(${data.headers.length}, minmax(120px, 1fr))` }}>
            {/* Headers */}
            {data.headers.map((header, index) => (
              <div 
                key={`header-${index}`}
                className="bg-muted/30 border border-border p-2 font-medium text-sm sticky top-0 z-10"
              >
                {header}
              </div>
            ))}
            
            {/* Data Rows */}
            {processedData.map((row, rowIndex) => 
              data.headers.map((header, colIndex) => {
                const isEditing = editingCell?.row === data.rows.findIndex(r => r === row) && editingCell?.col === header;
                
                return (
                  <div 
                    key={`cell-${rowIndex}-${colIndex}`}
                    className="border border-border p-0 relative group hover:bg-muted/50"
                  >
                    {isEditing ? (
                      <div className="flex items-center p-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          className="h-8 text-sm border-0 focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <div className="flex ml-2">
                          <Button size="sm" variant="ghost" onClick={saveEdit} className="h-6 w-6 p-0">
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 w-6 p-0">
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="p-2 h-10 text-sm cursor-pointer flex items-center"
                        onClick={() => startEdit(rowIndex, header)}
                      >
                        {row[header] || ''}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {/* Table Header with Controls */}
      <div className="border-b bg-muted/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            <span className="font-medium">Enhanced Table View</span>
          </div>
          {showSpreadsheetToggle && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setViewMode('spreadsheet')}
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Spreadsheet View
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {data.headers.slice(0, 4).map(header => (
            <div key={header} className="relative">
              <Filter className="h-3 w-3 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Filter ${header}...`}
                value={filters[header] || ''}
                onChange={(e) => handleFilter(header, e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[600px]">
        <table className="w-full">
          <thead className="sticky top-0 bg-background border-b">
            <tr>
              {data.headers.map((header, index) => (
                <th 
                  key={`${header}-${index}`}
                  className="p-3 text-left font-medium cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort(header)}
                >
                  <div className="flex items-center gap-2">
                    {header}
                    {sortConfig?.key === header && (
                      sortConfig.direction === 'asc' ? 
                        <ChevronUp className="h-3 w-3" /> : 
                        <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedData.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b hover:bg-muted/25 transition-colors">
                {data.headers.map((header, colIndex) => {
                  const actualRowIndex = data.rows.findIndex(r => r === row);
                  const isEditing = editingCell?.row === actualRowIndex && editingCell?.col === header;
                  
                  return (
                    <td key={`${header}-${colIndex}`} className="p-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="h-8 text-sm"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={saveEdit}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="cursor-pointer hover:bg-muted/50 p-1 rounded min-h-[2rem] flex items-center"
                          onClick={() => startEdit(rowIndex, header)}
                        >
                          {row[header] || ''}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="border-t bg-muted/30 p-3 text-sm text-muted-foreground">
        Showing {processedData.length} of {data.rows.length} records
        {Object.keys(filters).some(key => filters[key]) && (
          <span className="ml-2">(filtered)</span>
        )}
      </div>
    </div>
  );
}