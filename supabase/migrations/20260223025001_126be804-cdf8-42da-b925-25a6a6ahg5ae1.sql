-- Create direct_message_images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('direct_message_images', 'direct_message_images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies first (if they exist)
DROP POLICY IF EXISTS "Public read direct_message_images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload direct_message_images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update direct_message_images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete direct_message_images" ON storage.objects;

-- Create new policies
CREATE POLICY "Public read direct_message_images"
ON storage.objects FOR SELECT
USING (bucket_id = 'direct_message_images');

CREATE POLICY "Anyone can upload direct_message_images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'direct_message_images');

CREATE POLICY "Anyone can update direct_message_images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'direct_message_images');

CREATE POLICY "Anyone can delete direct_message_images"
ON storage.objects FOR DELETE
USING (bucket_id = 'direct_message_images');

-- Add image fields to direct_messages table
ALTER TABLE public.direct_messages 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_name TEXT;
