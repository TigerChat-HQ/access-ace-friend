DROP POLICY IF EXISTS "Authenticated users add members" ON public.conversation_members;
CREATE POLICY "Members or group admins add members" ON public.conversation_members
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.group_admins ga WHERE ga.conversation_id = conversation_members.conversation_id AND ga.user_id = auth.uid())
  OR (
    public.is_conversation_member(conversation_members.conversation_id, auth.uid())
    AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_members.conversation_id AND c.type <> 'direct')
  )
);

DROP POLICY IF EXISTS "User trophies viewable" ON public.user_trophies;
CREATE POLICY "Users view own trophies or admins all" ON public.user_trophies
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone authenticated can view roles" ON public.user_roles;
CREATE POLICY "Users view own roles or admins all" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));