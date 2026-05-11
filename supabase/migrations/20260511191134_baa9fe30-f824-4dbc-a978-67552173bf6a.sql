
-- 1) Tighten DM image read access to participants only
DROP POLICY IF EXISTS "DM images authed read" ON storage.objects;

CREATE POLICY "DM images participants read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'direct_message_images' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.image_url = storage.objects.name
        AND (dm.sender_user_id = auth.uid() OR dm.receiver_user_id = auth.uid())
    )
  )
);

-- 2) Remove unused games table (game system removed from app)
DROP TABLE IF EXISTS public.games CASCADE;

-- 3) Enforce username fields from authenticated user's profile to prevent impersonation
CREATE OR REPLACE FUNCTION public.enforce_username_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  rname text;
BEGIN
  SELECT username INTO uname FROM public.profiles WHERE user_id = auth.uid();
  IF uname IS NULL THEN
    RAISE EXCEPTION 'Profile not found for authenticated user';
  END IF;

  IF TG_TABLE_NAME = 'messages' THEN
    NEW.username := uname;
  ELSIF TG_TABLE_NAME = 'reactions' THEN
    NEW.username := uname;
  ELSIF TG_TABLE_NAME = 'direct_messages' THEN
    NEW.sender_username := uname;
    SELECT username INTO rname FROM public.profiles WHERE user_id = NEW.receiver_user_id;
    IF rname IS NOT NULL THEN
      NEW.receiver_username := rname;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_username_messages ON public.messages;
CREATE TRIGGER enforce_username_messages
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_username_from_profile();

DROP TRIGGER IF EXISTS enforce_username_reactions ON public.reactions;
CREATE TRIGGER enforce_username_reactions
BEFORE INSERT ON public.reactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_username_from_profile();

DROP TRIGGER IF EXISTS enforce_username_dm ON public.direct_messages;
CREATE TRIGGER enforce_username_dm
BEFORE INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_username_from_profile();
