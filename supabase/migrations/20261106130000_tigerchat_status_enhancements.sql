-- TIGERCHAT Status enhancements: text-only stories and audience controls.
ALTER TABLE public.stories
  ALTER COLUMN image_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'everyone'
    CHECK (audience IN ('everyone', 'only_me')),
  ADD COLUMN IF NOT EXISTS background_color TEXT NOT NULL DEFAULT '#6D28D9';

-- Replace the broad read policy with audience-aware access.
DROP POLICY IF EXISTS "Stories viewable by everyone" ON public.stories;
CREATE POLICY "Stories visible to selected audience"
  ON public.stories FOR SELECT TO authenticated
  USING (
    expires_at > now()
    AND (audience = 'everyone' OR user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_stories_active_created
  ON public.stories (created_at DESC)
  WHERE expires_at > now();

-- Prevent duplicate reactions from being inserted by retrying clients.
CREATE UNIQUE INDEX IF NOT EXISTS idx_story_reactions_unique
  ON public.story_reactions (story_id, user_id, emoji);
