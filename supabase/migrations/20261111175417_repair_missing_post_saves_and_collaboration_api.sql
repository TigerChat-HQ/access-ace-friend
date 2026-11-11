-- Repair schema objects used by the deployed Posts saved-post and collaboration UI.
-- Keep these grants paired with RLS: saved posts are private to their owner,
-- and collaboration rows are visible only to their inviter or invitee.

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

CREATE TABLE IF NOT EXISTS public.post_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_collaborators_unique_invitee UNIQUE (post_id, invitee_id),
  CONSTRAINT post_collaborators_not_self CHECK (inviter_id <> invitee_id)
);
CREATE INDEX IF NOT EXISTS idx_post_collaborators_invitee_status
  ON public.post_collaborators(invitee_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_collaborators_post_status
  ON public.post_collaborators(post_id,status);
ALTER TABLE public.post_collaborators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view relevant post collaborations" ON public.post_collaborators;
CREATE POLICY "Users view relevant post collaborations" ON public.post_collaborators
  FOR SELECT TO authenticated
  USING (inviter_id = (select auth.uid()) OR invitee_id = (select auth.uid()));
DROP POLICY IF EXISTS "Post owners invite collaborators" ON public.post_collaborators;
CREATE POLICY "Post owners invite collaborators" ON public.post_collaborators
  FOR INSERT TO authenticated WITH CHECK (
    inviter_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.user_id = (select auth.uid())
    )
  );
DROP POLICY IF EXISTS "Invitees respond to collaboration" ON public.post_collaborators;
CREATE POLICY "Invitees respond to collaboration" ON public.post_collaborators
  FOR UPDATE TO authenticated
  USING (invitee_id = (select auth.uid()) AND status = 'pending')
  WITH CHECK (invitee_id = (select auth.uid()) AND status IN ('accepted','declined'));
DROP POLICY IF EXISTS "Participants remove collaboration" ON public.post_collaborators;
CREATE POLICY "Participants remove collaboration" ON public.post_collaborators
  FOR DELETE TO authenticated
  USING (inviter_id = (select auth.uid()) OR invitee_id = (select auth.uid()));
REVOKE ALL ON public.post_collaborators FROM anon, authenticated, PUBLIC;
GRANT SELECT, DELETE ON public.post_collaborators TO authenticated;
GRANT INSERT (post_id, inviter_id, invitee_id)
  ON public.post_collaborators TO authenticated;
REVOKE UPDATE ON public.post_collaborators FROM authenticated;
GRANT UPDATE (status, updated_at)
  ON public.post_collaborators TO authenticated;

DROP POLICY IF EXISTS "Accepted collaborators view shared posts" ON public.posts;
CREATE POLICY "Accepted collaborators view shared posts" ON public.posts
  FOR SELECT TO authenticated USING (
    is_draft = false
    AND (scheduled_at IS NULL OR scheduled_at <= now())
    AND EXISTS (
      SELECT 1 FROM public.post_collaborators pc
      WHERE pc.post_id = posts.id
        AND pc.invitee_id = (select auth.uid())
        AND pc.status = 'accepted'
    )
  );

-- Return collaborator IDs only when the caller is allowed to view the post.
CREATE OR REPLACE FUNCTION public.get_post_collaborator_ids(_post_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pc.invitee_id
  FROM public.post_collaborators pc
  JOIN public.posts p ON p.id = pc.post_id
  WHERE pc.post_id = _post_id
    AND pc.status = 'accepted'
    AND p.is_draft = false
    AND (p.scheduled_at IS NULL OR p.scheduled_at <= now())
    AND (
      p.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.post_collaborators viewer_pc
        WHERE viewer_pc.post_id = p.id
          AND viewer_pc.invitee_id = auth.uid()
          AND viewer_pc.status = 'accepted'
      )
      OR p.audience = 'public'
      OR (
        p.audience = 'followers'
        AND EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = auth.uid()
            AND f.following_id = p.user_id
        )
      )
    );
$$;
REVOKE ALL ON FUNCTION public.get_post_collaborator_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_post_collaborator_ids(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
