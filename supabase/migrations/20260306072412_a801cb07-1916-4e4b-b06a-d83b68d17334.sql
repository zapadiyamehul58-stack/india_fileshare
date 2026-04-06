
-- Create storage bucket for cloud mode uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('shared-files', 'shared-files', true, 5368709120)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for shared-files bucket
CREATE POLICY "Anyone can upload files"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'shared-files');

CREATE POLICY "Anyone can read shared files"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'shared-files');

CREATE POLICY "Anyone can delete their uploaded files"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'shared-files');

-- Table to track shared files metadata
CREATE TABLE public.shared_files (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL DEFAULT '',
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  downloads INTEGER NOT NULL DEFAULT 0,
  is_p2p BOOLEAN NOT NULL DEFAULT false
);

-- Allow public access to shared_files
ALTER TABLE public.shared_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert shared files"
ON public.shared_files FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can read shared files"
ON public.shared_files FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can update shared files"
ON public.shared_files FOR UPDATE TO anon, authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete shared files"
ON public.shared_files FOR DELETE TO anon, authenticated
USING (true);

-- Enable realtime for signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_files;
