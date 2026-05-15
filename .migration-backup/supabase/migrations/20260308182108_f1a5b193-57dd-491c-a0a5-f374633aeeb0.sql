
CREATE TABLE public.chat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_locked boolean NOT NULL DEFAULT false,
  locked_by text NULL,
  locked_at timestamp with time zone NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat_settings" ON public.chat_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can update chat_settings" ON public.chat_settings FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert chat_settings" ON public.chat_settings FOR INSERT WITH CHECK (true);

INSERT INTO public.chat_settings (is_locked) VALUES (false);

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_settings;
