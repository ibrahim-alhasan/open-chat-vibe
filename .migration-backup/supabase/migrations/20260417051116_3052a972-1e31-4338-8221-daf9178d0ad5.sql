-- Add pinned_messages table for admin-pinned messages
CREATE TABLE IF NOT EXISTS public.pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  pinned_by text NOT NULL,
  pinned_at timestamp with time zone NOT NULL DEFAULT now(),
  content text NOT NULL,
  username text NOT NULL,
  user_id text
);

ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pinned" ON public.pinned_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pinned" ON public.pinned_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete pinned" ON public.pinned_messages FOR DELETE USING (true);

-- Ensure realtime works for reactions (full row payload on delete)
ALTER TABLE public.reactions REPLICA IDENTITY FULL;
ALTER TABLE public.pinned_messages REPLICA IDENTITY FULL;