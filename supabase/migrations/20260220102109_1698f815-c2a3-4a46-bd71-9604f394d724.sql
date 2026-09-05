
-- Create direct_messages table
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_username TEXT NOT NULL,
  receiver_username TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a DM (sender-based trust since no auth)
CREATE POLICY "Anyone can insert dm"
  ON public.direct_messages
  FOR INSERT
  WITH CHECK (true);

-- Anyone can read DMs (sender or receiver check done in app)
CREATE POLICY "Anyone can read dm"
  ON public.direct_messages
  FOR SELECT
  USING (true);

-- Anyone can update DM (for marking as read)
CREATE POLICY "Anyone can update dm"
  ON public.direct_messages
  FOR UPDATE
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
