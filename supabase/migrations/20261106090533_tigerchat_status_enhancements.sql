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

CREATE INDEX IF NOT EXISTS idx_stories_expiry_created
  ON public.stories (expires_at, created_at DESC);

-- Prevent duplicate reactions from being inserted by retrying clients.
CREATE UNIQUE INDEX IF NOT EXISTS idx_story_reactions_unique
  ON public.story_reactions (story_id, user_id, emoji);

-- Status comments/replies.
CREATE TABLE IF NOT EXISTS public.story_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.story_comments TO authenticated;
CREATE POLICY "Users read comments on visible stories"
  ON public.story_comments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_comments.story_id
      AND s.expires_at > now()
      AND (s.audience = 'everyone' OR s.user_id = auth.uid())
  ));
CREATE POLICY "Users comment as themselves on visible stories"
  ON public.story_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_comments.story_id
        AND s.expires_at > now()
        AND (s.audience = 'everyone' OR s.user_id = auth.uid())
    )
  );
CREATE POLICY "Users delete own story comments"
  ON public.story_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_story_comments_story_created
  ON public.story_comments (story_id, created_at DESC);
