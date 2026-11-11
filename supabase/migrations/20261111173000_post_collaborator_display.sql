-- Expose accepted collaborator handles only when the caller can already view the post.
-- This lets public/follower viewers see the same co-author labels without granting
-- broad SELECT access to the collaboration invitation table.
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
