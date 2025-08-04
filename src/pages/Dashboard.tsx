import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ExcelService } from '@/lib/excelService';
import { CSVService } from '@/lib/csvService';
import { 
  Upload, 
  FileText, 
  Download, 
  LogOut, 
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  FileDown,
  Trash2,
  Edit2,
  Save,
  X,
  Loader2
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

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [extractedDataList, setExtractedDataList] = useState<ExtractedData[]>([]);
  const [selectedData, setSelectedData] = useState<ExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [processingFiles, setProcessingFiles] = useState<Map<string, number>>(new Map());
  
  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    loadExtractedData();
    
    // Set up realtime subscription for processing updates
    const subscription = supabase
      .channel('processing_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processing_jobs',
          filter: `user_id=eq.${user.id}`
        },
        handleProcessingUpdate
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user.id]);

  const handleProcessingUpdate = (payload: any) => {
    if (payload.new && payload.new.document_id) {
      const progress = payload.new.progress || 0;
      setProcessingFiles(prev => new Map(prev).set(payload.new.document_id, progress));
      
      if (payload.new.status === 'completed') {
        loadExtractedData();
        toast({
          title: "प्रोसेसिंग पूर्ण / Processing Complete",
          description: "आपका डेटा तैयार है / Your data is ready",
        });
      } else if (payload.new.status === 'failed') {
        toast({
          title: "प्रोसेसिंग असफल / Processing Failed",
          description: payload.new.error_message || "कुछ गलत हुआ / Something went wrong",
          variant: "destructive"
        });
      }
    }
  };

  const loadExtractedData = async () => {
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
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setExtractedDataList(data || []);
      if (data && data.length > 0 && !selectedData) {
        setSelectedData(data[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "त्रुटि / Error",
        description: "डेटा लोड करने में असफल / Failed to load data",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const processFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      const totalFiles = files.length;
      let processedCount = 0;

      for (const file of files) {
        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save document record
        const { data: document, error: dbError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            filename: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type,
            processing_status: 'pending'
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Get signed URL for the file (valid for 1 hour)
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(fileName, 3600); // 1 hour expiry
        
        if (urlError) throw urlError;

        // Call Edge Function for OCR processing
        const { data: functionData, error: functionError } = await supabase.functions
          .invoke('process-ocr', {
            body: {
              fileUrl: signedUrlData.signedUrl,
              documentId: document.id,
              userId: user.id,
              fileType: file.type
            }
          });

        if (functionError) throw functionError;

        processedCount++;
        setProcessingProgress((processedCount / totalFiles) * 100);
      }

      // Reload data after processing
      setTimeout(() => {
        loadExtractedData();
      }, 1000);

    } catch (error: any) {
      console.error('Processing error:', error);
      toast({
        title: "प्रोसेसिंग त्रुटि / Processing Error",
        description: error.message || "कुछ गलत हुआ / Something went wrong",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      event.target.value = ''; // Reset file input
    }
  };

  const startEditingCell = (rowIndex: number, column: string, value: string) => {
    setEditingCell({ rowIndex, column, value });
  };

  const saveEdit = async () => {
    if (!editingCell || !selectedData) return;

    const updatedRows = [...selectedData.data.rows];
    updatedRows[editingCell.rowIndex] = {
      ...updatedRows[editingCell.rowIndex],
      [editingCell.column]: editingCell.value
    };

    const updatedData = {
      ...selectedData,
      data: {
        ...selectedData.data,
        rows: updatedRows
      },
      is_edited: true
    };

    try {
      const { error } = await supabase
        .from('extracted_data')
        .update({
          data: updatedData.data,
          is_edited: true
        })
        .eq('id', selectedData.id);

      if (error) throw error;

      setSelectedData(updatedData);
      setExtractedDataList(prev =>
        prev.map(item => item.id === selectedData.id ? updatedData : item)
      );
      
      toast({
        title: "सहेजा गया / Saved",
        description: "परिवर्तन सफलतापूर्वक सहेजे गए / Changes saved successfully",
      });
    } catch (error) {
      toast({
        title: "त्रुटि / Error",
        description: "परिवर्तन सहेजने में असफल / Failed to save changes",
        variant: "destructive"
      });
    } finally {
      setEditingCell(null);
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
  };

  const downloadCSV = (data: ExtractedData) => {
    try {
      CSVService.generateCSVFile(data.data.rows, `${data.document?.filename?.replace(/\.[^/.]+$/, "") || 'data'}.csv`);
      toast({
        title: "CSV डाउनलोड / CSV Download",
        description: "CSV फाइल सफलतापूर्वक डाउनलोड हुई / CSV file downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "डाउनलोड त्रुटि / Download Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const downloadExcel = (data: ExtractedData) => {
    try {
      ExcelService.generateExcelFile(data.data.rows, {
        fileName: `${data.document?.filename?.replace(/\.[^/.]+$/, "") || 'data'}.xlsx`,
        sheetName: 'Register Data'
      });
      toast({
        title: "Excel डाउनलोड / Excel Download",
        description: "Excel फाइल सफलतापूर्वक डाउनलोड हुई / Excel file downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "डाउनलोड त्रुटि / Download Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteData = async (id: string) => {
    try {
      const { error } = await supabase
        .from('extracted_data')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setExtractedDataList(prev => prev.filter(item => item.id !== id));
      if (selectedData?.id === id) {
        setSelectedData(extractedDataList.length > 1 ? extractedDataList[0] : null);
      }

      toast({
        title: "हटाया गया / Deleted",
        description: "डेटा सफलतापूर्वक हटाया गया / Data deleted successfully",
      });
    } catch (error) {
      toast({
        title: "त्रुटि / Error",
        description: "डेटा हटाने में असफल / Failed to delete data",
        variant: "destructive"
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "लॉगआउट सफल / Logged Out",
      description: "आप सफलतापूर्वक लॉगआउट हो गए हैं / You have been successfully logged out",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary-glow/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-primary to-primary-glow rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                  EasyRecord
                </h1>
                <p className="text-sm text-muted-foreground">डैशबोर्ड / Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-muted-foreground">सक्रिय सदस्यता / Active Subscription</p>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                लॉगआउट / Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Upload Section */}
        <Card className="mb-8 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              हस्तलिखित रजिस्टर अपलोड करें / Upload Handwritten Register
            </CardTitle>
            <CardDescription>
              तस्वीरें या PDF अपलोड करें और उच्च सटीकता के साथ डेटा निकालें / Upload images or PDFs and extract data with high accuracy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-primary/25 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">तस्वीरें या PDF यहाँ छोड़ें / Drop Images or PDFs Here</h3>
              <p className="text-muted-foreground mb-4">या क्लिक करके चुनें / or click to select</p>
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={processFiles}
                className="hidden"
                id="file-upload"
                disabled={isProcessing}
              />
              <Button 
                asChild 
                disabled={isProcessing}
                className="bg-gradient-to-r from-primary to-primary-glow"
              >
                <label htmlFor="file-upload" className="cursor-pointer">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      प्रोसेसिंग... / Processing...
                    </>
                  ) : (
                    "तस्वीरें या PDF चुनें / Select Images or PDFs"
                  )}
                </label>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Google Vision & Gemini API द्वारा संचालित / Powered by Google Vision & Gemini API
              </p>
            </div>
            
            {isProcessing && (
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>प्रगति / Progress</span>
                  <span>{Math.round(processingProgress)}%</span>
                </div>
                <Progress value={processingProgress} className="w-full" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Overview */}
        {extractedDataList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">कुल फाइलें / Total Files</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{extractedDataList.length}</div>
                <p className="text-xs text-muted-foreground">प्रोसेस की गई / Processed</p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">कुल रिकॉर्ड्स / Total Records</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {extractedDataList.reduce((sum, item) => sum + (item.data.rows?.length || 0), 0)}
                </div>
                <p className="text-xs text-muted-foreground">निकाले गए / Extracted</p>
              </CardContent>
            </Card>

          <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">औसत सटीकता / Avg Accuracy</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {extractedDataList.length > 0 
                    ? Math.round(extractedDataList.reduce((sum, item) => sum + item.confidence, 0) / extractedDataList.length)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">विश्वसनीयता / Confidence</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Data Files List and Table */}
        {extractedDataList.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Files List */}
            <Card className="lg:col-span-1 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                  फाइलें / Files ({extractedDataList.length})
              </CardTitle>
            </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-0">
                  {extractedDataList.map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedData?.id === item.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''
                      }`}
                      onClick={() => setSelectedData(item)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.document?.filename || 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.data.rows?.length || 0} रिकॉर्ड्स / records
                          </p>
                      <p className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString('hi-IN')}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={item.confidence > 90 ? "default" : "secondary"} className="text-xs">
                            {Math.round(item.confidence)}%
                          </Badge>
                          {item.is_edited && (
                            <Badge variant="outline" className="text-xs">
                              <Edit2 className="h-2 w-2 mr-1" />
                              संपादित / Edited
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteData(item.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

            {/* Data Table */}
            <Card className="lg:col-span-3 shadow-card">
            <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
              <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      डेटा टेबल / Data Table
              </CardTitle>
                    {selectedData && (
                      <CardDescription>
                        {selectedData.document?.filename || 'Unnamed'} - {selectedData.data.rows?.length || 0} रिकॉर्ड्स / records
                      </CardDescription>
                    )}
                  </div>
                  {selectedData && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => downloadExcel(selectedData)}>
                        <FileSpreadsheet className="h-3 w-3 mr-1" />
                        Excel
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadCSV(selectedData)}>
                        <FileDown className="h-3 w-3 mr-1" />
                        CSV
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedData && selectedData.data.rows && selectedData.data.rows.length > 0 ? (
                  <div className="rounded-md border overflow-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {selectedData.data.headers.map((header) => (
                            <TableHead key={header} className="font-semibold">
                              {header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedData.data.rows.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {selectedData.data.headers.map((header) => (
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
                    {isLoading ? (
                      <div>
                        <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-muted-foreground/50" />
                        <p>डेटा लोड हो रहा है / Loading data...</p>
              </div>
                    ) : extractedDataList.length === 0 ? (
                      <div>
                        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p>कोई डेटा नहीं मिला / No data found</p>
                        <p className="text-sm">तस्वीरें या PDF अपलोड करके शुरू करें / Start by uploading images or PDFs</p>
                      </div>
                    ) : (
                      <div>
                        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p>कोई फाइल चुनी नहीं गई / No file selected</p>
                        <p className="text-sm">बाईं ओर से कोई फाइल चुनें / Select a file from the left</p>
                    </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
              </div>
        )}

        {/* Empty State */}
        {extractedDataList.length === 0 && !isProcessing && !isLoading && (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-xl font-semibold mb-2">अपनी पहली फाइल अपलोड करें / Upload Your First File</h3>
              <p className="text-muted-foreground mb-4">
                हस्तलिखित रजिस्टर की तस्वीरें या PDF अपलोड करें और उच्च सटीकता के साथ डेटा निकालें
                <br />
                Upload handwritten register images or PDFs and extract data with high accuracy
              </p>
              <Button className="bg-gradient-to-r from-primary to-primary-glow">
                <label htmlFor="file-upload" className="cursor-pointer">
                  शुरू करें / Get Started
                </label>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}