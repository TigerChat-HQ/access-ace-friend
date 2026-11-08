-- Protect all public Draughts ranking data with explicit read-only policies.
ALTER TABLE public.draughts_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draughts_player_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Draughts seasons are public" ON public.draughts_seasons;
CREATE POLICY "Draughts seasons are public" ON public.draughts_seasons
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Draughts player stats are public" ON public.draughts_player_stats;
CREATE POLICY "Draughts player stats are public" ON public.draughts_player_stats
  FOR SELECT TO authenticated USING (true);
