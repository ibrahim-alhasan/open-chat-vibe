
-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for avatars bucket
CREATE POLICY "Public read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Anyone can upload avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Anyone can update avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');

-- Create profiles table to store username -> avatar_url mapping
CREATE TABLE IF NOT EXISTS public.profiles (
  username TEXT PRIMARY KEY,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read profiles"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert profile"
ON public.profiles FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update profile"
ON public.profiles FOR UPDATE
USING (true);

-- Create reactions table
CREATE TABLE IF NOT EXISTS public.reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, username, emoji)
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions"
ON public.reactions FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert reaction"
ON public.reactions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can delete reaction"
ON public.reactions FOR DELETE
USING (true);

-- Enable realtime for reactions and profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
