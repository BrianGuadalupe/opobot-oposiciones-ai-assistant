
-- Create table for academy contacts
CREATE TABLE public.academy_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  student_count INTEGER NOT NULL,
  city TEXT NOT NULL,
  contacted BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS) - Only admins should access this data
ALTER TABLE public.academy_contacts ENABLE ROW LEVEL SECURITY;

-- Create policy for admins only (you can adjust this based on your admin system)
CREATE POLICY "Only admins can view academy contacts" 
  ON public.academy_contacts 
  FOR ALL
  USING (false); -- This will block all access for now, you can update it later when you implement admin roles

-- Create an index for better performance on email lookups
CREATE INDEX idx_academy_contacts_email ON public.academy_contacts(email);

-- Create an index for filtering by contacted status
CREATE INDEX idx_academy_contacts_contacted ON public.academy_contacts(contacted);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_academy_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the updated_at field
CREATE TRIGGER trigger_update_academy_contacts_updated_at
  BEFORE UPDATE ON public.academy_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_academy_contacts_updated_at();
