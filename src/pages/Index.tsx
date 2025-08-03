import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  Upload, 
  Download, 
  CheckCircle, 
  Languages,
  Smartphone,
  IndianRupee,
  ArrowRight
} from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();

  // Redirect authenticated users to dashboard
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary-glow/10">
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="p-4 bg-gradient-to-r from-primary to-primary-glow rounded-2xl shadow-glow">
              <FileText className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              EasyRecord
            </h1>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-semibold mb-6 max-w-4xl mx-auto">
            हस्तलिखित रजिस्टर को Excel में बदलें
            <br />
            <span className="text-muted-foreground">Convert handwritten registers to Excel tables</span>
          </h2>
          
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            छोटे व्यापारियों के लिए बनाया गया सरल समाधान। अपने हस्तलिखित डेटा को डिजिटल Excel फाइलों में तुरंत बदलें।
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90">
              <a href="/auth">
                अभी शुरू करें / Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline">
              डेमो देखें / View Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">
            मुख्य विशेषताएं / Key Features
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="shadow-card hover:shadow-elegant transition-all">
              <CardHeader>
                <Upload className="h-10 w-10 text-primary mb-2" />
                <CardTitle>बल्क अपलोड / Bulk Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  एक साथ कई तस्वीरें अपलोड करें। तेज़ और आसान प्रोसेसिंग।
                  Upload multiple images at once. Fast and easy processing.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-elegant transition-all">
              <CardHeader>
                <FileText className="h-10 w-10 text-primary mb-2" />
                <CardTitle>OCR Technology</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  उन्नत OCR तकनीक। हिंदी और अंग्रेजी दोनों भाषाओं में काम करता है।
                  Advanced OCR technology. Works with both Hindi and English.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-elegant transition-all">
              <CardHeader>
                <Download className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Excel Download</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  तुरंत Excel फाइल डाउनलोड करें। मौजूदा फाइलों में नया डेटा जोड़ें।
                  Instantly download Excel files. Append to existing sheets.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-elegant transition-all">
              <CardHeader>
                <Languages className="h-10 w-10 text-primary mb-2" />
                <CardTitle>भाषा समर्थन / Language Support</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  हिंदी और अंग्रेजी दोनों भाषाओं में इंटरफेस। स्थानीय व्यापारियों के लिए उपयुक्त।
                  Interface in both Hindi and English. Perfect for local businesses.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-elegant transition-all">
              <CardHeader>
                <Smartphone className="h-10 w-10 text-primary mb-2" />
                <CardTitle>मोबाइल फ्रेंडली / Mobile Friendly</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  अपने मोबाइल फोन से सब कुछ करें। कहीं भी, कभी भी उपयोग करें।
                  Do everything from your mobile phone. Use anywhere, anytime.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-elegant transition-all">
              <CardHeader>
                <IndianRupee className="h-10 w-10 text-primary mb-2" />
                <CardTitle>किफायती / Affordable</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  सिर्फ ₹99 प्रति महीना। छोटे व्यापारियों के लिए उपयुक्त मूल्य।
                  Only ₹99 per month. Perfect pricing for small businesses.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12">
            कैसे काम करता है / How It Works
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-primary to-primary-glow rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h4 className="text-xl font-semibold mb-2">अपलोड करें / Upload</h4>
              <p className="text-muted-foreground">
                अपनी हस्तलिखित रजिस्टर की तस्वीरें अपलोड करें
                Upload images of your handwritten registers
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-primary to-primary-glow rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h4 className="text-xl font-semibold mb-2">प्रोसेसिंग / Processing</h4>
              <p className="text-muted-foreground">
                हमारी OCR तकनीक आपका डेटा पढ़ती और समझती है
                Our OCR technology reads and understands your data
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-primary to-primary-glow rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h4 className="text-xl font-semibold mb-2">डाउनलोड / Download</h4>
              <p className="text-muted-foreground">
                तैयार Excel फाइल को डाउनलोड करें और उपयोग करें
                Download the ready Excel file and start using it
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h3 className="text-3xl font-bold mb-8">
            सरल मूल्य निर्धारण / Simple Pricing
          </h3>
          
          <Card className="max-w-md mx-auto shadow-elegant">
            <CardHeader>
              <CardTitle className="text-2xl">मासिक योजना / Monthly Plan</CardTitle>
              <div className="text-4xl font-bold text-primary">₹99</div>
              <CardDescription>प्रति महीना / per month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>असीमित अपलोड / Unlimited uploads</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>OCR प्रोसेसिंग / OCR processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Excel डाउनलोड / Excel downloads</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>मोबाइल सपोर्ट / Mobile support</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>हिंदी + अंग्रेजी / Hindi + English</span>
                </div>
              </div>
              
              <Button className="w-full bg-gradient-to-r from-primary to-primary-glow" asChild>
                <a href="/auth">अभी शुरू करें / Start Now</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">EasyRecord</span>
          </div>
          <p className="text-muted-foreground">
            छोटे व्यापारियों के लिए डिजिटल समाधान / Digital solutions for small businesses
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
