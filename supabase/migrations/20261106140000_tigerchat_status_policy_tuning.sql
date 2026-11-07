-- Tune Status indexes and RLS predicates after initial rollout.
-- The table already has a UNIQUE constraint covering these three columns.
DROP INDEX IF EXISTS public.idx_story_reactions_unique;

-- Support filtering replies by author as well as by story.
CREATE INDEX IF NOT EXISTS idx_story_comments_user_id
  ON public.story_comments (user_id);

-- Wrap auth.uid() in a scalar subquery so it is evaluated once per statement.
DROP POLICY IF EXISTS "Stories visible to selected audience" ON public.stories;
CREATE POLICY "Stories visible to selected audience"
  ON public.stories FOR SELECT TO authenticated
  USING (
    expires_at > now()
    AND (audience = 'everyone' OR user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Users read comments on visible stories" ON public.story_comments;
CREATE POLICY "Users read comments on visible stories"
  ON public.story_comments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_comments.story_id
      AND s.expires_at > now()
      AND (s.audience = 'everyone' OR s.user_id = (SELECT auth.uid()))
  ));

DROP POLICY IF EXISTS "Users comment as themselves on visible stories" ON public.story_comments;
CREATE POLICY "Users comment as themselves on visible stories"
  ON public.story_comments FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_comments.story_id
        AND s.expires_at > now()
        AND (s.audience = 'everyone' OR s.user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users delete own story comments" ON public.story_comments;
CREATE POLICY "Users delete own story comments"
  ON public.story_comments FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
