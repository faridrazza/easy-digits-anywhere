import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Edit2,
  Trash2,
  Save,
  X,
  Eye,
  FileSpreadsheet,
  FileDown,
  ArrowLeft
} from 'lucide-react';

interface ExtractedData {
  id: string;
  document_id: string;
  data: {
    headers: string[];
    rows: Array<Record<string, string>>;
  };
  confidence: number;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  document?: {
    filename: string;
  };
}

interface EditingCell {
  rowIndex: number;
  column: string;
  value: string;
}

interface DashboardFilesProps {
  extractedDataList: ExtractedData[];
  onDeleteFile: (id: string) => void;
  onDownloadExcel: (data: ExtractedData) => void;
  onDownloadCSV: (data: ExtractedData) => void;
  onUpdateData: (id: string, updatedData: any) => void;
}

export default function DashboardFiles({ 
  extractedDataList, 
  onDeleteFile, 
  onDownloadExcel, 
  onDownloadCSV,
  onUpdateData 
}: DashboardFilesProps) {
  const [selectedFile, setSelectedFile] = useState<ExtractedData | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);

  const startEditingCell = (rowIndex: number, column: string, value: string) => {
    setEditingCell({ rowIndex, column, value });
  };

  const saveEdit = async () => {
    if (!editingCell || !selectedFile) return;

    const updatedRows = [...selectedFile.data.rows];
    updatedRows[editingCell.rowIndex] = {
      ...updatedRows[editingCell.rowIndex],
      [editingCell.column]: editingCell.value
    };

    const updatedData = {
      ...selectedFile,
      data: {
        ...selectedFile.data,
        rows: updatedRows
      },
      is_edited: true
    };

    setSelectedFile(updatedData);
    onUpdateData(selectedFile.id, updatedData.data);
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  if (selectedFile) {
    return (
      <div className="space-y-6">
        {/* File View Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedFile(null)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              वापस / Back
            </Button>
            <div>
              <h2 className="text-xl font-semibold">{selectedFile.document?.filename || 'Unnamed'}</h2>
              <p className="text-sm text-muted-foreground">
                {selectedFile.data.rows?.length || 0} रिकॉर्ड्स / records • {Math.round(selectedFile.confidence)}% सटीकता / accuracy
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => onDownloadExcel(selectedFile)}>
              <FileSpreadsheet className="h-3 w-3 mr-1" />
              Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDownloadCSV(selectedFile)}>
              <FileDown className="h-3 w-3 mr-1" />
              CSV
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              डेटा टेबल / Data Table
            </CardTitle>
            <CardDescription>
              डेटा संपादित करने के लिए किसी भी सेल पर क्लिक करें / Click on any cell to edit data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedFile.data.rows && selectedFile.data.rows.length > 0 ? (
              <div className="rounded-md border overflow-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedFile.data.headers.map((header) => (
                        <TableHead key={header} className="font-semibold">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedFile.data.rows.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {selectedFile.data.headers.map((header) => (
                          <TableCell 
                            key={header} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => startEditingCell(rowIndex, header, row[header] || '')}
                          >
                            {editingCell && editingCell.rowIndex === rowIndex && editingCell.column === header ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  value={editingCell.value}
                                  onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit();
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 px-2"
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
                              <div className="flex items-center justify-between group">
                                <span>{row[header] || '-'}</span>
                                <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>कोई डेटा उपलब्ध नहीं / No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Files List Header */}
      <div>
        <h2 className="text-2xl font-bold">सभी फाइलें / All Files</h2>
        <p className="text-muted-foreground">आपकी अपलोड की गई सभी फाइलों की सूची / List of all your uploaded files</p>
      </div>

      {/* Files List */}
      {extractedDataList.length > 0 ? (
        <div className="grid gap-4">
          {extractedDataList.map((item) => (
            <Card key={item.id} className="shadow-card hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">
                        {item.document?.filename || 'Unnamed'}
                      </h3>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-sm text-muted-foreground">
                          {item.data.rows?.length || 0} रिकॉर्ड्स / records
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString('hi-IN')}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={item.confidence > 90 ? "default" : "secondary"}>
                        {Math.round(item.confidence)}% सटीकता / accuracy
                      </Badge>
                      {item.is_edited && (
                        <Badge variant="outline" className="text-xs">
                          <Edit2 className="h-2 w-2 mr-1" />
                          संपादित / Edited
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setSelectedFile(item)}
                        className="bg-gradient-to-r from-primary to-primary-glow"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        देखें / View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDeleteFile(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-card">
          <CardContent className="py-12 text-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-xl font-semibold mb-2">कोई फाइल नहीं मिली / No Files Found</h3>
            <p className="text-muted-foreground">
              अभी तक कोई फाइल अपलोड नहीं की गई है। होम पेज पर जाकर फाइलें अपलोड करें।
              <br />
              No files uploaded yet. Go to the Home page to upload files.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}