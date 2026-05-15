
-- Create polls table
CREATE TABLE public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text NOT NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true
);

-- Create poll_votes table
CREATE TABLE public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  user_id text NOT NULL,
  option_index integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- Enable RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for polls
CREATE POLICY "Anyone can read polls" ON public.polls FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert polls" ON public.polls FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update polls" ON public.polls FOR UPDATE TO public USING (true);

-- RLS policies for poll_votes
CREATE POLICY "Anyone can read poll_votes" ON public.poll_votes FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert poll_votes" ON public.poll_votes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can delete poll_votes" ON public.poll_votes FOR DELETE TO public USING (true);

-- Enable realtime for polls
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;

-- Add unique constraint on profiles username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (username);
