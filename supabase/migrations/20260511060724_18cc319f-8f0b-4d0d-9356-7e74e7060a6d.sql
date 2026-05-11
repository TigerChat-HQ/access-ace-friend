CREATE TABLE public.draft_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_white uuid NOT NULL,
  player_black uuid,
  vs_ai boolean NOT NULL DEFAULT false,
  board jsonb NOT NULL,
  current_turn text NOT NULL DEFAULT 'white',
  status text NOT NULL DEFAULT 'waiting',
  winner text,
  last_move jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.draft_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated views matches"
ON public.draft_matches FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users create matches as white"
ON public.draft_matches FOR INSERT TO authenticated
WITH CHECK (auth.uid() = player_white);

CREATE POLICY "Players update their matches"
ON public.draft_matches FOR UPDATE TO authenticated
USING (auth.uid() = player_white OR auth.uid() = player_black OR (vs_ai AND auth.uid() = player_white));

CREATE POLICY "Players delete their matches"
ON public.draft_matches FOR DELETE TO authenticated
USING (auth.uid() = player_white);

CREATE TRIGGER update_draft_matches_updated_at
BEFORE UPDATE ON public.draft_matches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.draft_matches;
ALTER TABLE public.draft_matches REPLICA IDENTITY FULL;