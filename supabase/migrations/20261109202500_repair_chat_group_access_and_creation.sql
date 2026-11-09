-- Repair broken chat visibility policies and restore atomic group creation.
DROP POLICY IF EXISTS "Users view own conversations" ON public.conversations;
CREATE POLICY "Users view own conversations"
ON public.conversations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members AS cm
    WHERE cm.conversation_id = conversations.id
      AND cm.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users update own conversations" ON public.conversations;
CREATE POLICY "Users update own conversations"
ON public.conversations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members AS cm
    WHERE cm.conversation_id = conversations.id
      AND cm.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversation_members AS cm
    WHERE cm.conversation_id = conversations.id
      AND cm.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users view members of own conversations" ON public.conversation_members;
CREATE POLICY "Users view members of own conversations"
ON public.conversation_members FOR SELECT TO authenticated
USING (public.is_conversation_member(conversation_members.conversation_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "Authenticated users add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users add members" ON public.conversation_members;
CREATE POLICY "Group admins add members"
ON public.conversation_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_admins AS ga
    WHERE ga.conversation_id = conversation_members.conversation_id
      AND ga.user_id = (SELECT auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.create_group_conversation(_name text, _member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_conversation_id uuid;
  v_name text := nullif(btrim(_name), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;
  IF v_name IS NULL OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'Group name must contain 1 to 80 characters';
  END IF;
  IF _member_ids IS NULL OR cardinality(_member_ids) < 1 THEN
    RAISE EXCEPTION 'Choose at least one group member';
  END IF;
  IF cardinality(_member_ids) > 100 THEN
    RAISE EXCEPTION 'A group can contain at most 100 invited members';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(_member_ids) AS selected(user_id)
    WHERE selected.user_id IS NULL OR selected.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Invalid group member selection';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (SELECT DISTINCT user_id FROM unnest(_member_ids) AS selected(user_id)) AS selected
    LEFT JOIN auth.users AS u ON u.id = selected.user_id
    WHERE u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more selected users do not exist';
  END IF;

  INSERT INTO public.conversations(type, name)
  VALUES ('group', v_name)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.conversation_members(conversation_id, user_id)
  SELECT v_conversation_id, members.user_id
  FROM (
    SELECT v_user_id AS user_id
    UNION
    SELECT DISTINCT selected.user_id
    FROM unnest(_member_ids) AS selected(user_id)
  ) AS members;

  INSERT INTO public.group_admins(conversation_id, user_id)
  VALUES (v_conversation_id, v_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_conversation_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_group_conversation(text, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_group_conversation(text, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[]) TO authenticated;
