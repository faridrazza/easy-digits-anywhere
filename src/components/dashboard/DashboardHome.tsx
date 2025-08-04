import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  CheckCircle,
  AlertCircle,
  Edit2,
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

interface DashboardHomeProps {
  extractedDataList: ExtractedData[];
  isProcessing: boolean;
  processingProgress: number;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function DashboardHome({ 
  extractedDataList, 
  isProcessing, 
  processingProgress, 
  onFileUpload
}: DashboardHomeProps) {
  const navigate = useNavigate();

  const handleFileSelect = (fileId: string) => {
    navigate(`/files/${fileId}`);
  };
  // Calculate stats
  const totalFiles = extractedDataList.length;
  const totalRecords = extractedDataList.reduce((sum, item) => sum + (item.data.rows?.length || 0), 0);
  const averageAccuracy = totalFiles > 0 
    ? Math.round(extractedDataList.reduce((sum, item) => sum + item.confidence, 0) / totalFiles)
    : 0;

  // Get latest 5 files
  const latestFiles = extractedDataList.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="shadow-card">
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
              onChange={onFileUpload}
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

      {/* Stats Cards */}
      {totalFiles > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">कुल फाइलें / Total Files</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalFiles}</div>
              <p className="text-xs text-muted-foreground">प्रोसेस की गई / Processed</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">कुल रिकॉर्ड्स / Total Records</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRecords}</div>
              <p className="text-xs text-muted-foreground">निकाले गए / Extracted</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">औसत सटीकता / Avg Accuracy</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{averageAccuracy}%</div>
              <p className="text-xs text-muted-foreground">विश्वसनीयता / Confidence</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Files */}
      {latestFiles.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              हाल की फाइलें / Recent Files
            </CardTitle>
            <CardDescription>
              आपकी नवीनतम अपलोड की गई फाइलें / Your latest uploaded files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {latestFiles.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleFileSelect(item.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium truncate max-w-[200px]">
                        {item.document?.filename || 'Unnamed'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.data.rows?.length || 0} रिकॉर्ड्स / records • {new Date(item.created_at).toLocaleDateString('hi-IN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.confidence > 90 ? "default" : "secondary"} className="text-xs">
                      {Math.round(item.confidence)}%
                    </Badge>
                    {item.is_edited && (
                      <Badge variant="outline" className="text-xs">
                        <Edit2 className="h-2 w-2 mr-1" />
                        संपादित / Edited
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {totalFiles === 0 && !isProcessing && (
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
  );
}