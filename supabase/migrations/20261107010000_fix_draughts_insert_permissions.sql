-- Allow signed-in players to create draughts matches.
-- RLS policies do not grant SQL table privileges; both are required.
GRANT SELECT, INSERT, UPDATE ON TABLE public.draft_matches TO authenticated;

-- A match must be created by its white player with the black slot empty.
-- This supports both PvP waiting rooms and AI matches.
DROP POLICY IF EXISTS "Users create matches as white" ON public.draft_matches;
CREATE POLICY "Users create matches as white"
ON public.draft_matches
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = player_white
  AND player_black IS NULL
);
