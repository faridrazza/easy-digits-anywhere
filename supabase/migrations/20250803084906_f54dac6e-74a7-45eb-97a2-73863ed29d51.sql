-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  business_name TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create documents table for uploaded files
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  upload_status TEXT DEFAULT 'uploaded',
  processing_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create excel_sheets table for generated Excel files
CREATE TABLE public.excel_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sheet_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create processing_jobs table for OCR tracking
CREATE TABLE public.processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  excel_sheet_id UUID REFERENCES public.excel_sheets(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL, -- 'new_table' or 'append_to_existing'
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0,
  result_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'cancelled'
  plan_type TEXT DEFAULT 'monthly',
  amount INTEGER DEFAULT 99,
  currency TEXT DEFAULT 'INR',
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create RLS policies for documents
CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE USING (user_id = auth.uid());

-- Create RLS policies for excel_sheets
CREATE POLICY "Users can view own excel sheets" ON public.excel_sheets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own excel sheets" ON public.excel_sheets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own excel sheets" ON public.excel_sheets
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own excel sheets" ON public.excel_sheets
  FOR DELETE USING (user_id = auth.uid());

-- Create RLS policies for processing_jobs
CREATE POLICY "Users can view own processing jobs" ON public.processing_jobs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own processing jobs" ON public.processing_jobs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own processing jobs" ON public.processing_jobs
  FOR UPDATE USING (user_id = auth.uid());

-- Create RLS policies for subscriptions
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own subscription" ON public.subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subscription" ON public.subscriptions
  FOR UPDATE USING (user_id = auth.uid());

-- Create storage bucket for document uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Create storage bucket for excel files
INSERT INTO storage.buckets (id, name, public) VALUES ('excel-files', 'excel-files', false);

-- Create storage policies for documents
CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own documents" ON storage.objects
  FOR UPDATE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policies for excel files
CREATE POLICY "Users can upload their own excel files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'excel-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own excel files" ON storage.objects
  FOR SELECT USING (bucket_id = 'excel-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own excel files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'excel-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own excel files" ON storage.objects
  FOR DELETE USING (bucket_id = 'excel-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create function to handle profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  
  INSERT INTO public.subscriptions (user_id, status, starts_at, ends_at)
  VALUES (NEW.id, 'active', now(), now() + interval '30 days');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_processing_jobs_updated_at
  BEFORE UPDATE ON public.processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();