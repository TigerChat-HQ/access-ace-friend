-- Instagram-style profile post management: archive and pin.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_posts_owner_pinned
  ON public.posts (user_id, pinned_at DESC NULLS LAST, created_at DESC)
  WHERE archived_at IS NULL AND is_draft = false;

-- Archived posts remain visible to their owner only; other users never see them.
DROP POLICY IF EXISTS "Posts viewable by audience" ON public.posts;
CREATE POLICY "Posts viewable by audience"
  ON public.posts FOR SELECT TO authenticated
  USING (
    is_draft = false
    AND (scheduled_at IS NULL OR scheduled_at <= now())
    AND (
      user_id = (select auth.uid())
      OR (
        archived_at IS NULL
        AND (
          audience = 'public'
          OR (
            audience = 'followers'
            AND EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = (select auth.uid())
                AND f.following_id = posts.user_id
            )
          )
        )
      )
    )
  );
