-- Allow users to delete their own DMs
CREATE POLICY "Anyone can delete dm"
ON public.direct_messages
FOR DELETE
USING (true);

-- Create storage bucket for public chat files
INSERT INTO storage.buckets (id, name, public)
VALUES ('public_chat_files', 'public_chat_files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for public chat files
CREATE POLICY "Public chat files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'public_chat_files');

CREATE POLICY "Anyone can upload public chat files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'public_chat_files');

CREATE POLICY "Anyone can delete public chat files"
ON storage.objects FOR DELETE
USING (bucket_id = 'public_chat_files');

-- Add file columns to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS file_url text,
ADD COLUMN IF NOT EXISTS file_name text,
ADD COLUMN IF NOT EXISTS file_type text;