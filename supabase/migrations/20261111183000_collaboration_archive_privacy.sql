-- Archived posts are private to their owner, including previously accepted collaborators.
DROP POLICY IF EXISTS "Accepted collaborators view shared posts" ON public.posts;
CREATE POLICY "Accepted collaborators view shared posts" ON public.posts
  FOR SELECT TO authenticated
  USING (
    archived_at IS NULL
    AND is_draft = false
    AND (scheduled_at IS NULL OR scheduled_at <= now())
    AND EXISTS (
      SELECT 1 FROM public.post_collaborators pc
      WHERE pc.post_id = posts.id
        AND pc.invitee_id = (select auth.uid())
        AND pc.status = 'accepted'
    )
  );

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
    AND p.archived_at IS NULL
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

-- Co-author labels follow the same archive visibility rule.
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
    AND p.archived_at IS NULL
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
