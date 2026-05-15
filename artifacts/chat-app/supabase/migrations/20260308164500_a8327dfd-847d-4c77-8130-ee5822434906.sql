
CREATE TABLE public.games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_type text NOT NULL DEFAULT 'tictactoe',
  player_x text NOT NULL,
  player_o text,
  board text NOT NULL DEFAULT '---------',
  current_turn text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  winner text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read games" ON public.games FOR SELECT USING (true);
CREATE POLICY "Anyone can insert games" ON public.games FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update games" ON public.games FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete games" ON public.games FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
