-- Instagram-style saved posts: private bookmarks per authenticated user.
CREATE TABLE IF NOT EXISTS public.post_saves (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_saves_user_created
  ON public.post_saves (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_saves_post
  ON public.post_saves (post_id);

ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own saved posts" ON public.post_saves;
CREATE POLICY "Users manage their own saved posts"
  ON public.post_saves FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

REVOKE ALL ON TABLE public.post_saves FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.post_saves TO authenticated;
