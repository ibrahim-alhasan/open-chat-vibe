-- Archive table for deleted direct messages
CREATE TABLE public.deleted_direct_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  receiver_user_id uuid NOT NULL,
  sender_username text NOT NULL,
  receiver_username text NOT NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  reply_to_id uuid,
  reply_to_content text,
  image_url text,
  image_name text,
  original_created_at timestamp with time zone NOT NULL,
  deleted_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_deleted_dm_original_id ON public.deleted_direct_messages(original_id);
CREATE INDEX idx_deleted_dm_deleted_at ON public.deleted_direct_messages(deleted_at DESC);

-- Enable RLS but add NO policies => no client (anon/authenticated) can read or write.
-- The trigger runs as SECURITY DEFINER so it bypasses RLS.
ALTER TABLE public.deleted_direct_messages ENABLE ROW LEVEL SECURITY;

-- Trigger function: copy row to archive before delete
CREATE OR REPLACE FUNCTION public.archive_deleted_direct_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.deleted_direct_messages (
    original_id, sender_user_id, receiver_user_id,
    sender_username, receiver_username, content, is_read,
    reply_to_id, reply_to_content, image_url, image_name,
    original_created_at
  ) VALUES (
    OLD.id, OLD.sender_user_id, OLD.receiver_user_id,
    OLD.sender_username, OLD.receiver_username, OLD.content, OLD.is_read,
    OLD.reply_to_id, OLD.reply_to_content, OLD.image_url, OLD.image_name,
    OLD.created_at
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_archive_deleted_direct_message
BEFORE DELETE ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.archive_deleted_direct_message();