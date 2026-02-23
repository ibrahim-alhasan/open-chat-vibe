
-- Create blocked_users table
CREATE TABLE public.blocked_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(blocker_user_id, blocked_user_id)
);

-- Enable RLS
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read blocked_users" ON public.blocked_users FOR SELECT USING (true);
CREATE POLICY "Anyone can insert blocked_users" ON public.blocked_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete blocked_users" ON public.blocked_users FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_users;
