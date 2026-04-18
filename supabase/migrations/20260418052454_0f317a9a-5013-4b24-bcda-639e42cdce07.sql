-- Fix broken RLS policies on conversations and conversation_members,
-- and add a security-definer RPC for creating direct conversations atomically.

-- 1) Drop buggy policies
DROP POLICY IF EXISTS "Users view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users update own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users view members of own conversations" ON public.conversation_members;

-- 2) Helper: is the current user a member of a given conversation?
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

-- 3) Correct policies
CREATE POLICY "Users view own conversations"
ON public.conversations
FOR SELECT
USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "Users update own conversations"
ON public.conversations
FOR UPDATE
USING (public.is_conversation_member(id, auth.uid()));

CREATE POLICY "Users view members of own conversations"
ON public.conversation_members
FOR SELECT
USING (public.is_conversation_member(conversation_id, auth.uid()));

-- 4) Atomic creation of a direct conversation (returns conversation id)
CREATE OR REPLACE FUNCTION public.create_direct_conversation(_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  existing_id uuid;
  new_id uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _other_user_id IS NULL OR _other_user_id = me THEN
    RAISE EXCEPTION 'Invalid recipient';
  END IF;

  -- Find existing direct conversation between the two users
  SELECT c.id INTO existing_id
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND EXISTS (SELECT 1 FROM public.conversation_members m1 WHERE m1.conversation_id = c.id AND m1.user_id = me)
    AND EXISTS (SELECT 1 FROM public.conversation_members m2 WHERE m2.conversation_id = c.id AND m2.user_id = _other_user_id)
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO public.conversations (type) VALUES ('direct') RETURNING id INTO new_id;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (new_id, me), (new_id, _other_user_id);

  RETURN new_id;
END;
$$;

-- 5) Atomic creation of a group conversation
CREATE OR REPLACE FUNCTION public.create_group_conversation(_name text, _member_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  new_id uuid;
  uid uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.conversations (type, name) VALUES ('group', _name) RETURNING id INTO new_id;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (new_id, me);

  IF _member_ids IS NOT NULL THEN
    FOREACH uid IN ARRAY _member_ids LOOP
      IF uid <> me THEN
        INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (new_id, uid)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN new_id;
END;
$$;