
-- Add reply_to_id for reply feature
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id uuid DEFAULT NULL;

-- Allow users to delete their own messages
CREATE POLICY "Users delete own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = sender_id);
