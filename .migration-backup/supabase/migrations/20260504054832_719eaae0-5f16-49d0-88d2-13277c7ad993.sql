
-- 1. Drop old permissive storage policies
DROP POLICY IF EXISTS "Anyone can upload avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload direct_message_images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update direct_message_images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete direct_message_images" ON storage.objects;
DROP POLICY IF EXISTS "Public read direct_message_images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload public chat files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete public chat files" ON storage.objects;

-- 2. Tighten message length constraints to match UI (max 500)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_length_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length_check
  CHECK (char_length(content) <= 500);

ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_content_length_check;
ALTER TABLE public.direct_messages
  ADD CONSTRAINT direct_messages_content_length_check
  CHECK (char_length(content) <= 500);

-- 3. Realtime channel authorization
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authed realtime read" ON realtime.messages;
CREATE POLICY "Authed realtime read"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);
