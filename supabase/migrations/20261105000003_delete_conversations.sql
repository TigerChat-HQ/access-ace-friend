-- Allow a member to leave a conversation, which only hides it from that member's chat list.
DROP POLICY IF EXISTS "Members leave own conversations" ON public.conversation_members;
CREATE POLICY "Members leave own conversations"
  ON public.conversation_members
  FOR DELETE
  USING (user_id = auth.uid());

-- Deleting the conversation itself is the explicit "for everyone" operation.
-- The database cascades the delete to its memberships and messages.
DROP POLICY IF EXISTS "Members delete conversations for everyone" ON public.conversations;
CREATE POLICY "Members delete conversations for everyone"
  ON public.conversations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_members AS member
      WHERE member.conversation_id = conversations.id
        AND member.user_id = auth.uid()
    )
  );
