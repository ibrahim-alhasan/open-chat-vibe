
-- Create messages table for public chat
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  reply_to UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  reply_to_username TEXT,
  reply_to_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read messages (public chat)
CREATE POLICY "Anyone can read messages"
ON public.messages
FOR SELECT
USING (true);

-- Allow anyone to insert messages (public chat - no auth required)
CREATE POLICY "Anyone can insert messages"
ON public.messages
FOR INSERT
WITH CHECK (true);

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
