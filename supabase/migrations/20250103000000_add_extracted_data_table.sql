-- Create extracted_data table for storing OCR results
CREATE TABLE public.extracted_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  processing_job_id UUID REFERENCES public.processing_jobs(id) ON DELETE CASCADE,
  data JSONB NOT NULL, -- Stores the extracted table data
  confidence NUMERIC DEFAULT 0,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_extracted_data_user_id ON public.extracted_data(user_id);
CREATE INDEX idx_extracted_data_document_id ON public.extracted_data(document_id);

-- Enable RLS
ALTER TABLE public.extracted_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own extracted data" ON public.extracted_data
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own extracted data" ON public.extracted_data
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own extracted data" ON public.extracted_data
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own extracted data" ON public.extracted_data
  FOR DELETE USING (user_id = auth.uid());

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp update
CREATE TRIGGER update_extracted_data_updated_at BEFORE UPDATE
  ON public.extracted_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();