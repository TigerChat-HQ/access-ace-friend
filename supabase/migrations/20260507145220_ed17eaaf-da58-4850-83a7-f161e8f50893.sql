
DROP POLICY IF EXISTS "Users or admins delete posts" ON public.posts;
CREATE POLICY "Users admins or moderators delete posts" ON public.posts
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

DROP POLICY IF EXISTS "Users or admins delete comments" ON public.post_comments;
CREATE POLICY "Users admins or moderators delete comments" ON public.post_comments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

DROP POLICY IF EXISTS "Admins update reports" ON public.reports;
CREATE POLICY "Admins or moderators update reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "Admins view reports" ON public.reports;
CREATE POLICY "Admins moderators advisers view reports" ON public.reports
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.has_role(auth.uid(), 'adviser')
  );

CREATE OR REPLACE FUNCTION public.ensure_admin_super_group()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid(); super_id uuid;
BEGIN
  IF me IS NULL OR NOT (
    public.has_role(me, 'admin')
    OR public.has_role(me, 'moderator')
    OR public.has_role(me, 'adviser')
  ) THEN
    RAISE EXCEPTION 'Elevated role required';
  END IF;
  SELECT id INTO super_id FROM public.conversations
    WHERE type='group' AND name='🛡️ Admin Super Group' LIMIT 1;
  IF super_id IS NULL THEN
    INSERT INTO public.conversations (type, name)
    VALUES ('group', '🛡️ Admin Super Group') RETURNING id INTO super_id;
  END IF;
  INSERT INTO public.conversation_members (conversation_id, user_id)
    VALUES (super_id, me) ON CONFLICT DO NOTHING;
  IF public.has_role(me, 'admin') THEN
    INSERT INTO public.group_admins (conversation_id, user_id)
      VALUES (super_id, me) ON CONFLICT DO NOTHING;
  END IF;
  RETURN super_id;
END;
$$;
