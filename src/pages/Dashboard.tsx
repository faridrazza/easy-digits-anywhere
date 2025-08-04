import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ExcelService } from '@/lib/excelService';
import { CSVService } from '@/lib/csvService';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardHome from '@/components/dashboard/DashboardHome';
import DashboardFiles from '@/components/dashboard/DashboardFiles';
import { 
  FileText, 
  LogOut
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



export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [extractedDataList, setExtractedDataList] = useState<ExtractedData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingFiles, setProcessingFiles] = useState<Map<string, number>>(new Map());
  const [activeTab, setActiveTab] = useState<'home' | 'files'>('home');
  
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

  const updateData = async (id: string, updatedData: any) => {
    try {
      const { error } = await supabase
        .from('extracted_data')
        .update({
          data: updatedData,
          is_edited: true
        })
        .eq('id', id);

      if (error) throw error;

      setExtractedDataList(prev =>
        prev.map(item => item.id === id ? { ...item, data: updatedData, is_edited: true } : item)
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
    }
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
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-30">
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

      {/* Main Layout with Sidebar */}
      <div className="flex">
        {/* Sidebar */}
        <DashboardSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />

        {/* Main Content */}
        <div className="flex-1 lg:pl-0 pl-0">
          <main className="container mx-auto px-4 py-8 max-w-7xl">
            {activeTab === 'home' ? (
              <DashboardHome
                extractedDataList={extractedDataList}
                isProcessing={isProcessing}
                processingProgress={processingProgress}
                onFileUpload={processFiles}
              />
            ) : (
              <DashboardFiles
                extractedDataList={extractedDataList}
                onDeleteFile={deleteData}
              />
            )}
          </main>
              </div>
      </div>
    </div>
  );
}