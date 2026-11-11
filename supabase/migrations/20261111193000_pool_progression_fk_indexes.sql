-- Cover Pool progression foreign keys with indexes for joins and cascade paths.
CREATE INDEX IF NOT EXISTS pool_match_results_winner_idx ON public.pool_match_results(winner_id);
CREATE INDEX IF NOT EXISTS pool_match_results_loser_idx ON public.pool_match_results(loser_id);
CREATE INDEX IF NOT EXISTS pool_matches_tournament_idx ON public.pool_matches(tournament_id);
CREATE INDEX IF NOT EXISTS pool_tournament_matches_player_one_idx ON public.pool_tournament_matches(player_one);
CREATE INDEX IF NOT EXISTS pool_tournament_matches_player_two_idx ON public.pool_tournament_matches(player_two);
CREATE INDEX IF NOT EXISTS pool_tournament_matches_winner_idx ON public.pool_tournament_matches(winner_id);
CREATE INDEX IF NOT EXISTS pool_tournaments_owner_idx ON public.pool_tournaments(owner_id);
CREATE INDEX IF NOT EXISTS pool_user_cosmetics_cosmetic_idx ON public.pool_user_cosmetics(cosmetic_id);
