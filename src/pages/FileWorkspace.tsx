import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EnhancedTable } from '@/components/ui/enhanced-table';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ExcelService } from '@/lib/excelService';
import { CSVService } from '@/lib/csvService';
import AIAssistant from '@/components/ai/AIAssistant';
import { 
  ArrowLeft,
  FileText, 
  Edit2,
  Save,
  X,
  FileSpreadsheet,
  FileDown,
  Loader2,
  Sparkles,
  Share2,
  Download,
  Settings
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

export default function FileWorkspace() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [fileData, setFileData] = useState<ExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [showAI, setShowAI] = useState(true);

  useEffect(() => {
    if (!user || !fileId) return;
    loadFileData();
  }, [user, fileId]);

  const loadFileData = async () => {
    if (!fileId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('extracted_data')
        .select(`
          *,
          document:documents (
            filename
          )
        `)
        .eq('id', fileId)
        .eq('user_id', user?.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          toast({
            title: "File Not Found",
            description: "The requested file could not be found.",
            variant: "destructive"
          });
          navigate('/dashboard');
          return;
        }
        throw error;
      }

      setFileData(data);
    } catch (error) {
      console.error('Error loading file:', error);
      toast({
        title: "Error",
        description: "Failed to load file data",
        variant: "destructive"
      });
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const updateFileData = async (updatedData: any) => {
    if (!fileData) return;

    try {
      const { error } = await supabase
        .from('extracted_data')
        .update({
          data: updatedData,
          is_edited: true
        })
        .eq('id', fileData.id);

      if (error) throw error;

      setFileData(prev => prev ? {
        ...prev,
        data: updatedData,
        is_edited: true
      } : null);

      toast({
        title: "Saved",
        description: "Changes saved successfully",
      });
    } catch (error) {
      console.error('Error updating file:', error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive"
      });
    }
  };

  const startEditingCell = (rowIndex: number, column: string, value: string) => {
    setEditingCell({ rowIndex, column, value });
  };

  const saveEdit = async () => {
    if (!editingCell || !fileData) return;

    const updatedRows = [...fileData.data.rows];
    updatedRows[editingCell.rowIndex] = {
      ...updatedRows[editingCell.rowIndex],
      [editingCell.column]: editingCell.value
    };

    const updatedData = {
      ...fileData.data,
      rows: updatedRows
    };

    await updateFileData(updatedData);
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  const downloadExcel = () => {
    if (!fileData) return;
    
    try {
      ExcelService.generateExcelFile(fileData.data.rows, {
        fileName: `${fileData.document?.filename?.replace(/\.[^/.]+$/, "") || 'data'}.xlsx`,
        sheetName: 'Register Data'
      });
      toast({
        title: "Excel Download",
        description: "Excel file downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Download Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const downloadCSV = () => {
    if (!fileData) return;
    
    try {
      CSVService.generateCSVFile(fileData.data.rows, `${fileData.document?.filename?.replace(/\.[^/.]+$/, "") || 'data'}.csv`);
      toast({
        title: "CSV Download",
        description: "CSV file downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Download Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary-glow/5 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-lg font-medium">Loading file...</p>
        </div>
      </div>
    );
  }

  if (!fileData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary-glow/5 flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">File Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested file could not be found.</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary-glow/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-primary to-primary-glow rounded-lg">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">
                    {fileData.document?.filename || 'Unnamed File'}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {fileData.data.rows.length} rows • {fileData.data.headers.length} columns • {Math.round(fileData.confidence)}% accuracy
                    {fileData.is_edited && <span className="ml-2 text-blue-600">• Edited</span>}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAI(!showAI)}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {showAI ? 'Hide' : 'Show'} AI
              </Button>
              
              <Button size="sm" onClick={downloadExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
              
              <Button size="sm" variant="outline" onClick={downloadCSV}>
                <FileDown className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex">
        {/* Data Table */}
        <div className={`flex-1 transition-all duration-300 ${showAI ? 'mr-96' : ''}`}>
          <div className="container mx-auto px-4 py-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Data Table
                </CardTitle>
                <CardDescription>
                  Click on any cell to edit. Changes are saved automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <EnhancedTable
                  data={fileData.data}
                  onDataChange={(newData) => updateFileData(newData)}
                  showSpreadsheetToggle={true}
                  className="border-0 rounded-none"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* AI Assistant Sidebar */}
        {showAI && (
          <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-xl z-40">
            <div className="h-full pt-20">
              <AIAssistant
                documentId={fileData.document_id}
                fileData={fileData.data}
                onDataUpdate={updateFileData}
                className="h-[calc(100vh-5rem)] m-4"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}