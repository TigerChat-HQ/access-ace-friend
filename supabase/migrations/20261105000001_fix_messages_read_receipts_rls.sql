-- Allow conversation members to update messages in their conversations (e.g. delivered_at, read_at, is_read receipts)
-- while retaining sender's ability to update their own messages.

DROP POLICY IF EXISTS "Users update own messages" ON public.messages;
DROP POLICY IF EXISTS "Users update messages in own conversations" ON public.messages;

CREATE POLICY "Users update messages in own conversations"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  auth.uid() = sender_id
  OR EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = sender_id
  OR EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
  )
);
