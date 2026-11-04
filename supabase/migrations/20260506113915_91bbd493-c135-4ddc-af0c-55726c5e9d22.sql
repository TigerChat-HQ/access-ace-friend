-- Helper used by group-admin RLS policies.
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


-- Group admins table
CREATE TABLE public.group_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.group_admins ENABLE ROW LEVEL SECURITY;

-- Members of the group can see admins
CREATE POLICY "Group members view admins"
ON public.group_admins FOR SELECT
TO authenticated
USING (is_conversation_member(conversation_id, auth.uid()));

-- Only group admins can add other admins
CREATE POLICY "Group admins add admins"
ON public.group_admins FOR INSERT
TO authenticated
WITH CHECK (
  is_conversation_member(conversation_id, auth.uid())
  AND (
    EXISTS (SELECT 1 FROM public.group_admins ga WHERE ga.conversation_id = group_admins.conversation_id AND ga.user_id = auth.uid())
    OR NOT EXISTS (SELECT 1 FROM public.group_admins ga WHERE ga.conversation_id = group_admins.conversation_id)
  )
);

-- Only group admins can remove admins
CREATE POLICY "Group admins remove admins"
ON public.group_admins FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.group_admins ga WHERE ga.conversation_id = group_admins.conversation_id AND ga.user_id = auth.uid())
);

-- Add music_url to stories
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS music_url text;
