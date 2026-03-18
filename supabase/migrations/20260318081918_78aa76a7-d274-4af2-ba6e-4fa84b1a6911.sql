
CREATE TABLE public.banned_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  banned_by text NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read banned_users" ON public.banned_users FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert banned_users" ON public.banned_users FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can delete banned_users" ON public.banned_users FOR DELETE TO public USING (true);
