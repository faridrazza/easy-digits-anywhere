import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Edit2,
  Trash2,
  Eye,
  Sparkles
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

interface DashboardFilesProps {
  extractedDataList: ExtractedData[];
  onDeleteFile: (id: string) => void;
}

export default function DashboardFiles({ 
  extractedDataList, 
  onDeleteFile
}: DashboardFilesProps) {
  const navigate = useNavigate();

  const handleViewFile = (fileId: string) => {
    navigate(`/files/${fileId}`);
  };

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
                        onClick={() => handleViewFile(item.id)}
                        className="bg-gradient-to-r from-primary to-primary-glow"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        देखें / View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewFile(item.id)}
                        title="Open with AI Assistant"
                      >
                        <Sparkles className="h-4 w-4" />
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