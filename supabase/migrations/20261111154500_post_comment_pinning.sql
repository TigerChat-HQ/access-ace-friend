-- Allow the author of a post to pin or unpin comments on that post.
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_post_comments_post_pinned_created
  ON public.post_comments(post_id, pinned_at DESC NULLS LAST, created_at ASC);
DROP POLICY IF EXISTS "Post owners pin comments" ON public.post_comments;
CREATE POLICY "Post owners pin comments" ON public.post_comments
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = (select auth.uid())));

-- Limit updates to the moderation field; comment text remains immutable after posting.
REVOKE UPDATE ON public.post_comments FROM authenticated;
GRANT UPDATE (pinned_at) ON public.post_comments TO authenticated;
