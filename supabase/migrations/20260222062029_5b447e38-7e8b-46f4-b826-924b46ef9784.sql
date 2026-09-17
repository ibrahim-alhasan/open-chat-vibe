
-- Add allow_dms column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allow_dms boolean NOT NULL DEFAULT true;

-- Create admins table
CREATE TABLE public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admins" ON public.admins FOR SELECT USING (true);

-- Add DELETE policy on messages (anyone can delete - we'll check ownership in app code + admins)
CREATE POLICY "Anyone can delete messages" ON public.messages FOR DELETE USING (true);

-- Add UPDATE policy on messages  
CREATE POLICY "Anyone can update messages" ON public.messages FOR UPDATE USING (true);

-- Add reactions for DMs - create dm_reactions table
CREATE TABLE public.dm_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_id uuid NOT NULL,
  user_id text NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dm_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dm_reactions" ON public.dm_reactions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert dm_reactions" ON public.dm_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete dm_reactions" ON public.dm_reactions FOR DELETE USING (true);

-- Add reply columns to direct_messages
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS reply_to_id uuid;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS reply_to_content text;

-- Enable realtime for dm_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admins;
