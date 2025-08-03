import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Upload, 
  FileText, 
  Download, 
  Plus, 
  LogOut, 
  User, 
  Clock,
  CheckCircle,
  AlertCircle,
  Building
} from 'lucide-react';

interface Document {
  id: string;
  filename: string;
  processing_status: string;
  created_at: string;
}

interface ExcelSheet {
  id: string;
  sheet_name: string;
  total_rows: number;
  last_updated: string;
}

interface ProcessingJob {
  id: string;
  status: string;
  progress: number;
  job_type: string;
  created_at: string;
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [excelSheets, setExcelSheets] = useState<ExcelSheet[]>([]);
  const [processingJobs, setProcessingJobs] = useState<ProcessingJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      // Fetch documents
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });
      setDocuments(docs || []);

      // Fetch excel sheets
      const { data: sheets } = await supabase
        .from('excel_sheets')
        .select('*')
        .order('last_updated', { ascending: false });
      setExcelSheets(sheets || []);

      // Fetch processing jobs
      const { data: jobs } = await supabase
        .from('processing_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      setProcessingJobs(jobs || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Save to documents table
        const { error: dbError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            filename: file.name,
            file_path: fileName,
            file_size: file.size,
            file_type: file.type
          });

        if (dbError) throw dbError;
      }

      toast({
        title: "अपलोड सफल! / Upload Successful!",
        description: `${files.length} फाइल(s) सफलतापूर्वक अपलोड हुई / ${files.length} file(s) uploaded successfully`,
      });

      fetchUserData();
    } catch (error: any) {
      toast({
        title: "अपलोड त्रुटि / Upload Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "लॉगआउट सफल / Logged Out",
      description: "आप सफलतापूर्वक लॉगआउट हो गए हैं / You have been successfully logged out",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />पूर्ण / Complete</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" />प्रगति में / Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />असफल / Failed</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />प्रतीक्षा में / Pending</Badge>;
    }
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">अपलोड की गई फाइलें / Uploaded Files</CardTitle>
              <Upload className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documents.length}</div>
              <p className="text-xs text-muted-foreground">
                कुल डॉक्यूमेंट्स / Total documents
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Excel शीट्स / Excel Sheets</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{excelSheets.length}</div>
              <p className="text-xs text-muted-foreground">
                तैयार टेबल्स / Ready tables
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">प्रगति में / Processing</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {processingJobs.filter(job => job.status === 'processing').length}
              </div>
              <p className="text-xs text-muted-foreground">
                सक्रिय जॉब्स / Active jobs
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Upload Section */}
        <Card className="mb-8 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              नई फाइल अपलोड करें / Upload New Files
            </CardTitle>
            <CardDescription>
              हस्तलिखित रजिस्टर की तस्वीरें या PDF अपलोड करें / Upload images or PDFs of handwritten registers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">फाइल्स यहाँ छोड़ें / Drop files here</h3>
              <p className="text-muted-foreground mb-4">या क्लिक करके चुनें / or click to select</p>
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={isUploading}
              />
              <Button asChild disabled={isUploading}>
                <label htmlFor="file-upload" className="cursor-pointer">
                  {isUploading ? "अपलोड हो रहा है... / Uploading..." : "फाइल चुनें / Select Files"}
                </label>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                समर्थित: JPG, PNG, PDF | Supported: JPG, PNG, PDF
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Documents */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                हाल की फाइलें / Recent Files
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {documents.slice(0, 5).map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium truncate">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString('hi-IN')}
                      </p>
                    </div>
                    {getStatusBadge(doc.processing_status)}
                  </div>
                ))}
                {documents.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    कोई फाइल अपलोड नहीं की गई / No files uploaded yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Excel Sheets */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Excel शीट्स / Excel Sheets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {excelSheets.slice(0, 5).map((sheet) => (
                  <div key={sheet.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{sheet.sheet_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sheet.total_rows} पंक्तियाँ / {sheet.total_rows} rows
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      <Download className="h-3 w-3 mr-1" />
                      डाउनलोड / Download
                    </Button>
                  </div>
                ))}
                {excelSheets.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    कोई Excel शीट तैयार नहीं / No Excel sheets ready
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Processing Jobs */}
        {processingJobs.length > 0 && (
          <Card className="mt-6 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                प्रोसेसिंग स्थिति / Processing Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {processingJobs.map((job) => (
                  <div key={job.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {job.job_type === 'new_table' ? 'नई टेबल / New Table' : 'मौजूदा में जोड़ें / Append to Existing'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(job.created_at).toLocaleString('hi-IN')}
                        </p>
                      </div>
                      {getStatusBadge(job.status)}
                    </div>
                    {job.status === 'processing' && (
                      <Progress value={job.progress} className="w-full" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}