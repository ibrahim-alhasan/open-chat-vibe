
-- Add user_id column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_id TEXT UNIQUE;

-- Add user_id to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add user_id to direct_messages table  
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS sender_user_id TEXT;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS receiver_user_id TEXT;
