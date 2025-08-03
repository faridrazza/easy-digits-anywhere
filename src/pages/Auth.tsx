import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, FileText, Upload, Download } from 'lucide-react';

export default function Auth() {
  const { user, signIn, signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Get the default tab from URL params
  const defaultTab = searchParams.get('tab') === 'signin' ? 'signin' : 'signup';
  
  // Form states
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Redirect if already authenticated
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(signInEmail, signInPassword);
    
    if (error) {
      toast({
        title: "साइन इन में त्रुटि / Sign In Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "स्वागत है! / Welcome!",
        description: "आपका अकाउंट सफलतापूर्वक लॉगिन हो गया है / Successfully signed in",
      });
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signUp(signUpEmail, signUpPassword, fullName);
    
    if (error) {
      toast({
        title: "साइन अप में त्रुटि / Sign Up Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "अकाउंट बनाया गया! / Account Created!",
        description: "आपका अकाउंट सफलतापूर्वक बनाया गया है / Your account has been created successfully",
      });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-primary-glow/10">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="p-3 bg-gradient-to-r from-primary to-primary-glow rounded-lg">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              EasyRecord
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            हस्तलिखित रजिस्टर को Excel में बदलें | Convert handwritten registers to Excel tables
          </p>
          
          {/* Feature highlights */}
          <div className="flex flex-wrap justify-center gap-6 mt-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Upload className="h-4 w-4 text-primary" />
              <span>बल्क अपलोड / Bulk Upload</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 text-primary" />
              <span>OCR Technology</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Download className="h-4 w-4 text-primary" />
              <span>Excel Download</span>
            </div>
          </div>
        </div>

        {/* Auth Form */}
        <div className="max-w-md mx-auto">
          <Card className="shadow-elegant">
            <CardHeader className="text-center">
              <CardTitle>अकाउंट में लॉगिन करें / Login to Account</CardTitle>
              <CardDescription>
                अपने डेटा को सुरक्षित रखने के लिए लॉगिन करें / Login to keep your data secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">लॉगिन / Sign In</TabsTrigger>
                  <TabsTrigger value="signup">साइन अप / Sign Up</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">ईमेल / Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="your@email.com"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">पासवर्ड / Password</Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={signInPassword}
                          onChange={(e) => setSignInPassword(e.target.value)}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-all"
                      disabled={isLoading}
                    >
                      {isLoading ? "लॉगिन हो रहा है... / Signing In..." : "लॉगिन करें / Sign In"}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullname">पूरा नाम / Full Name</Label>
                      <Input
                        id="fullname"
                        type="text"
                        placeholder="आपका नाम / Your Name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">ईमेल / Email</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">पासवर्ड / Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-all"
                      disabled={isLoading}
                    >
                      {isLoading ? "अकाउंट बनाया जा रहा है... / Creating Account..." : "अकाउंट बनाएं / Create Account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          {/* Pricing Info */}
          <Card className="mt-6 bg-gradient-to-r from-primary/5 to-primary-glow/5 border-primary/20">
            <CardContent className="pt-6 text-center">
              <h3 className="font-semibold text-lg mb-2">सिर्फ ₹99 प्रति महीना / Only ₹99 per month</h3>
              <p className="text-sm text-muted-foreground">
                असीमित अपलोड • OCR प्रोसेसिंग • Excel डाउनलोड<br />
                Unlimited uploads • OCR processing • Excel downloads
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}