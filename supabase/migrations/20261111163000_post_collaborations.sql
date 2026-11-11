-- Invitation and acceptance workflow for collaborative posts.
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
CREATE INDEX IF NOT EXISTS idx_post_collaborators_invitee_status ON public.post_collaborators(invitee_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_collaborators_post_status ON public.post_collaborators(post_id,status);
ALTER TABLE public.post_collaborators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view relevant post collaborations" ON public.post_collaborators;
CREATE POLICY "Users view relevant post collaborations" ON public.post_collaborators
  FOR SELECT TO authenticated USING (
    inviter_id = (select auth.uid())
    OR invitee_id = (select auth.uid())
  );
DROP POLICY IF EXISTS "Post owners invite collaborators" ON public.post_collaborators;
CREATE POLICY "Post owners invite collaborators" ON public.post_collaborators
  FOR INSERT TO authenticated WITH CHECK (
    inviter_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = (select auth.uid()))
  );
DROP POLICY IF EXISTS "Invitees respond to collaboration" ON public.post_collaborators;
CREATE POLICY "Invitees respond to collaboration" ON public.post_collaborators
  FOR UPDATE TO authenticated USING (invitee_id = (select auth.uid()) AND status = 'pending')
  WITH CHECK (invitee_id = (select auth.uid()) AND status IN ('accepted','declined'));
DROP POLICY IF EXISTS "Participants remove collaboration" ON public.post_collaborators;
CREATE POLICY "Participants remove collaboration" ON public.post_collaborators
  FOR DELETE TO authenticated USING (inviter_id = (select auth.uid()) OR invitee_id = (select auth.uid()));
REVOKE ALL ON public.post_collaborators FROM anon, authenticated, PUBLIC;
GRANT SELECT, DELETE ON public.post_collaborators TO authenticated;

-- Only the inviter, as checked by RLS, may create a pending invitation.
-- Column-level INSERT grants prevent clients from inserting an already-accepted row.
GRANT INSERT (post_id, inviter_id, invitee_id) ON public.post_collaborators TO authenticated;

-- Invitees may only change the response state and its timestamp.
REVOKE UPDATE ON public.post_collaborators FROM authenticated;
GRANT UPDATE (status, updated_at) ON public.post_collaborators TO authenticated;

-- Accepted collaborators can view the published post even when its audience is
-- private or followers-only. Drafts and scheduled posts remain unavailable.
DROP POLICY IF EXISTS "Accepted collaborators view shared posts" ON public.posts;
CREATE POLICY "Accepted collaborators view shared posts" ON public.posts
  FOR SELECT TO authenticated
  USING (
    is_draft = false
    AND (scheduled_at IS NULL OR scheduled_at <= now())
    AND EXISTS (
      SELECT 1 FROM public.post_collaborators pc
      WHERE pc.post_id = posts.id
        AND pc.invitee_id = (select auth.uid())
        AND pc.status = 'accepted'
    )
  );

-- Return only published collaboration IDs visible to the requesting profile viewer.
-- SECURITY DEFINER avoids exposing the collaboration table broadly or creating RLS recursion.
CREATE OR REPLACE FUNCTION public.get_profile_collaboration_post_ids(_profile_id uuid)
RETURNS TABLE(post_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pc.post_id
  FROM public.post_collaborators pc
  JOIN public.posts p ON p.id = pc.post_id
  WHERE pc.invitee_id = _profile_id
    AND pc.status = 'accepted'
    AND p.is_draft = false
    AND (p.scheduled_at IS NULL OR p.scheduled_at <= now())
    AND (
      auth.uid() = _profile_id
      OR auth.uid() = p.user_id
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
REVOKE ALL ON FUNCTION public.get_profile_collaboration_post_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_collaboration_post_ids(uuid) TO authenticated;
