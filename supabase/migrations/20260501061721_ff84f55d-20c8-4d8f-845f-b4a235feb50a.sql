
-- Drop ALL old policies first
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can insert profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can update profile" ON public.profiles;
DROP POLICY IF EXISTS "Update only profiles with user_id" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can read messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can insert messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can update messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can delete messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can read dm" ON public.direct_messages;
DROP POLICY IF EXISTS "Anyone can insert dm" ON public.direct_messages;
DROP POLICY IF EXISTS "Anyone can update dm" ON public.direct_messages;
DROP POLICY IF EXISTS "Anyone can delete dm" ON public.direct_messages;
DROP POLICY IF EXISTS "Anyone can read reactions" ON public.reactions;
DROP POLICY IF EXISTS "Anyone can insert reaction" ON public.reactions;
DROP POLICY IF EXISTS "Anyone can delete reaction" ON public.reactions;
DROP POLICY IF EXISTS "Anyone can read dm_reactions" ON public.dm_reactions;
DROP POLICY IF EXISTS "Anyone can insert dm_reactions" ON public.dm_reactions;
DROP POLICY IF EXISTS "Anyone can delete dm_reactions" ON public.dm_reactions;
DROP POLICY IF EXISTS "Anyone can read polls" ON public.polls;
DROP POLICY IF EXISTS "Anyone can insert polls" ON public.polls;
DROP POLICY IF EXISTS "Anyone can update polls" ON public.polls;
DROP POLICY IF EXISTS "Anyone can read poll_votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Anyone can insert poll_votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Anyone can delete poll_votes" ON public.poll_votes;
DROP POLICY IF EXISTS "Anyone can read pinned" ON public.pinned_messages;
DROP POLICY IF EXISTS "Anyone can insert pinned" ON public.pinned_messages;
DROP POLICY IF EXISTS "Anyone can delete pinned" ON public.pinned_messages;
DROP POLICY IF EXISTS "Anyone can read banned_users" ON public.banned_users;
DROP POLICY IF EXISTS "Anyone can insert banned_users" ON public.banned_users;
DROP POLICY IF EXISTS "Anyone can delete banned_users" ON public.banned_users;
DROP POLICY IF EXISTS "Anyone can read blocked_users" ON public.blocked_users;
DROP POLICY IF EXISTS "Anyone can insert blocked_users" ON public.blocked_users;
DROP POLICY IF EXISTS "Anyone can delete blocked_users" ON public.blocked_users;
DROP POLICY IF EXISTS "Anyone can read chat_settings" ON public.chat_settings;
DROP POLICY IF EXISTS "Anyone can insert chat_settings" ON public.chat_settings;
DROP POLICY IF EXISTS "Anyone can update chat_settings" ON public.chat_settings;
DROP POLICY IF EXISTS "Anyone can read games" ON public.games;
DROP POLICY IF EXISTS "Anyone can insert games" ON public.games;
DROP POLICY IF EXISTS "Anyone can update games" ON public.games;
DROP POLICY IF EXISTS "Anyone can delete games" ON public.games;
DROP POLICY IF EXISTS "Anyone can read admins" ON public.admins;

-- Wipe old data
TRUNCATE TABLE public.reactions, public.dm_reactions, public.poll_votes, public.polls,
  public.pinned_messages, public.banned_users, public.blocked_users, public.chat_settings,
  public.games, public.direct_messages, public.messages, public.profiles RESTART IDENTITY CASCADE;

-- USER ROLES
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

DROP POLICY IF EXISTS "Anyone can read roles" ON public.user_roles;
CREATE POLICY "Anyone can read roles" ON public.user_roles FOR SELECT USING (true);

-- PROFILES
ALTER TABLE public.profiles DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.profiles ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE POLICY "Profiles readable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uname text;
BEGIN
  uname := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = uname) LOOP
    uname := uname || floor(random()*1000)::text;
  END LOOP;
  INSERT INTO public.profiles (user_id, username, allow_dms) VALUES (NEW.id, uname, true);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- MESSAGES
ALTER TABLE public.messages DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.messages ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE POLICY "Public read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Authed insert own messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors or admins delete messages" ON public.messages FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- DIRECT MESSAGES
ALTER TABLE public.direct_messages DROP COLUMN IF EXISTS sender_user_id;
ALTER TABLE public.direct_messages DROP COLUMN IF EXISTS receiver_user_id;
ALTER TABLE public.direct_messages ADD COLUMN sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.direct_messages ADD COLUMN receiver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE POLICY "Participants or admins read dm" ON public.direct_messages FOR SELECT
  USING (auth.uid() = sender_user_id OR auth.uid() = receiver_user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Sender insert dm" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid() = sender_user_id);
CREATE POLICY "Receiver mark read" ON public.direct_messages FOR UPDATE
  USING (auth.uid() = receiver_user_id) WITH CHECK (auth.uid() = receiver_user_id);
CREATE POLICY "Participants delete dm" ON public.direct_messages FOR DELETE
  USING (auth.uid() = sender_user_id OR auth.uid() = receiver_user_id OR public.is_admin(auth.uid()));

-- REACTIONS
ALTER TABLE public.reactions DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.reactions ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE POLICY "Public read reactions" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "Authed insert own reaction" ON public.reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authed delete own reaction" ON public.reactions FOR DELETE USING (auth.uid() = user_id);

-- DM REACTIONS
ALTER TABLE public.dm_reactions DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.dm_reactions ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE POLICY "Authed read dm_reactions" ON public.dm_reactions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authed insert own dm_reactions" ON public.dm_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authed delete own dm_reactions" ON public.dm_reactions FOR DELETE USING (auth.uid() = user_id);

-- POLLS
ALTER TABLE public.polls DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.polls ADD COLUMN created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE POLICY "Public read polls" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Admins create polls" ON public.polls FOR INSERT
  WITH CHECK (auth.uid() = created_by AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update polls" ON public.polls FOR UPDATE USING (public.is_admin(auth.uid()));

ALTER TABLE public.poll_votes DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.poll_votes ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE POLICY "Public read poll_votes" ON public.poll_votes FOR SELECT USING (true);
CREATE POLICY "Authed vote" ON public.poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authed unvote" ON public.poll_votes FOR DELETE USING (auth.uid() = user_id);

-- PINNED
ALTER TABLE public.pinned_messages DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.pinned_messages DROP COLUMN IF EXISTS pinned_by;
ALTER TABLE public.pinned_messages ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.pinned_messages ADD COLUMN pinned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE POLICY "Public read pinned" ON public.pinned_messages FOR SELECT USING (true);
CREATE POLICY "Admins pin" ON public.pinned_messages FOR INSERT
  WITH CHECK (auth.uid() = pinned_by AND public.is_admin(auth.uid()));
CREATE POLICY "Admins unpin" ON public.pinned_messages FOR DELETE USING (public.is_admin(auth.uid()));

-- BANNED
ALTER TABLE public.banned_users DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.banned_users DROP COLUMN IF EXISTS banned_by;
ALTER TABLE public.banned_users ADD COLUMN user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE;
ALTER TABLE public.banned_users ADD COLUMN banned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE POLICY "Public read banned" ON public.banned_users FOR SELECT USING (true);
CREATE POLICY "Admins ban" ON public.banned_users FOR INSERT
  WITH CHECK (auth.uid() = banned_by AND public.is_admin(auth.uid()));
CREATE POLICY "Admins unban" ON public.banned_users FOR DELETE USING (public.is_admin(auth.uid()));

-- BLOCKED
ALTER TABLE public.blocked_users DROP COLUMN IF EXISTS blocker_user_id;
ALTER TABLE public.blocked_users DROP COLUMN IF EXISTS blocked_user_id;
ALTER TABLE public.blocked_users ADD COLUMN blocker_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blocked_users ADD COLUMN blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE POLICY "Users see own blocks" ON public.blocked_users FOR SELECT
  USING (auth.uid() = blocker_user_id OR auth.uid() = blocked_user_id);
CREATE POLICY "Users create own blocks" ON public.blocked_users FOR INSERT WITH CHECK (auth.uid() = blocker_user_id);
CREATE POLICY "Users remove own blocks" ON public.blocked_users FOR DELETE USING (auth.uid() = blocker_user_id);

-- CHAT SETTINGS
ALTER TABLE public.chat_settings DROP COLUMN IF EXISTS locked_by;
ALTER TABLE public.chat_settings ADD COLUMN locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE POLICY "Public read chat_settings" ON public.chat_settings FOR SELECT USING (true);
CREATE POLICY "Admins insert chat_settings" ON public.chat_settings FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update chat_settings" ON public.chat_settings FOR UPDATE USING (public.is_admin(auth.uid()));
INSERT INTO public.chat_settings (is_locked) VALUES (false);

-- GAMES
ALTER TABLE public.games DROP COLUMN IF EXISTS player_x;
ALTER TABLE public.games DROP COLUMN IF EXISTS player_o;
ALTER TABLE public.games DROP COLUMN IF EXISTS current_turn;
ALTER TABLE public.games DROP COLUMN IF EXISTS winner;
ALTER TABLE public.games ADD COLUMN player_x uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.games ADD COLUMN player_o uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.games ADD COLUMN current_turn uuid;
ALTER TABLE public.games ADD COLUMN winner uuid;
CREATE POLICY "Players read games" ON public.games FOR SELECT
  USING (auth.uid() = player_x OR auth.uid() = player_o);
CREATE POLICY "Players create games" ON public.games FOR INSERT WITH CHECK (auth.uid() = player_x);
CREATE POLICY "Players update games" ON public.games FOR UPDATE
  USING (auth.uid() = player_x OR auth.uid() = player_o);
CREATE POLICY "Players delete games" ON public.games FOR DELETE
  USING (auth.uid() = player_x OR auth.uid() = player_o);

-- DROP legacy admins
DROP TABLE IF EXISTS public.admins CASCADE;

-- STORAGE
DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;
DROP POLICY IF EXISTS "Avatar own upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar own update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar own delete" ON storage.objects;
CREATE POLICY "Avatar public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Avatar own upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Avatar own update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Avatar own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "DM images authed read" ON storage.objects;
DROP POLICY IF EXISTS "DM images authed write" ON storage.objects;
DROP POLICY IF EXISTS "DM images own delete" ON storage.objects;
CREATE POLICY "DM images authed read" ON storage.objects FOR SELECT
  USING (bucket_id = 'direct_message_images' AND auth.uid() IS NOT NULL);
CREATE POLICY "DM images authed write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'direct_message_images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "DM images own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'direct_message_images' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Public files read" ON storage.objects;
DROP POLICY IF EXISTS "Public files authed write" ON storage.objects;
DROP POLICY IF EXISTS "Public files own delete" ON storage.objects;
CREATE POLICY "Public files read" ON storage.objects FOR SELECT USING (bucket_id = 'public_chat_files');
CREATE POLICY "Public files authed write" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'public_chat_files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Public files own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'public_chat_files' AND auth.uid()::text = (storage.foldername(name))[1]);
