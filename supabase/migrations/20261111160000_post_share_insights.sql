-- Track post shares so creators can see real engagement insights.
CREATE TABLE IF NOT EXISTS public.post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_shares_post_created ON public.post_shares(post_id, created_at DESC);
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users share visible posts as self" ON public.post_shares;
CREATE POLICY "Users share visible posts as self" ON public.post_shares
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid()) AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id)
  );
DROP POLICY IF EXISTS "Creators view post share insights" ON public.post_shares;
CREATE POLICY "Creators view post share insights" ON public.post_shares
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = (select auth.uid()))
    OR user_id = (select auth.uid())
  );
REVOKE ALL ON public.post_shares FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT ON public.post_shares TO authenticated;
