-- Allow regular users' Smart Card comments to be liked while keeping
-- Tiger AI system comments non-user-owned and not AI-liked.
-- This restores the production migration recorded as 20261112164912.
ALTER TABLE public.tiger_ai_smart_card_comments
  DROP CONSTRAINT IF EXISTS tiger_ai_smart_card_comment_identity;

ALTER TABLE public.tiger_ai_smart_card_comments
  ADD CONSTRAINT tiger_ai_smart_card_comment_identity
  CHECK (
    (is_tiger_ai = false AND user_id IS NOT NULL AND mentioned_user_id IS NULL)
    OR (is_tiger_ai = true AND user_id IS NULL AND ai_liked = false)
  );
