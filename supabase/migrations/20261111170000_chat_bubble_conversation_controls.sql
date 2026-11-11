ALTER TABLE public.chat_preferences
  ADD COLUMN IF NOT EXISTS muted_until timestamptz;
CREATE INDEX IF NOT EXISTS idx_chat_preferences_muted_until
  ON public.chat_preferences(user_id, conversation_id, muted_until)
  WHERE muted_until IS NOT NULL;
