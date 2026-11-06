-- Repair online draughts matchmaking and optimistic turn synchronization.
ALTER TABLE public.draft_matches
  ADD COLUMN IF NOT EXISTS join_code text,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;

-- Give older matches a code and enforce uniqueness for future matchmaking.
UPDATE public.draft_matches
SET join_code = upper(substr(replace(id::text, '-', ''), 1, 6))
WHERE join_code IS NULL OR btrim(join_code) = '';

ALTER TABLE public.draft_matches
  ALTER COLUMN join_code SET DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  ALTER COLUMN join_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS draft_matches_join_code_key
  ON public.draft_matches (upper(join_code));

-- A joining player is not yet a participant, so the previous policy prevented
-- every opponent from claiming the empty black-player slot.
DROP POLICY IF EXISTS "Players update their matches" ON public.draft_matches;
CREATE POLICY "Players update or join matches"
ON public.draft_matches
FOR UPDATE TO authenticated
USING (
  auth.uid() = player_white
  OR auth.uid() = player_black
  OR (status = 'waiting' AND vs_ai = false AND player_black IS NULL)
)
WITH CHECK (
  auth.uid() = player_white
  OR auth.uid() = player_black
);

-- Keep waiting-room reads available to signed-in users, as required by the lobby.
