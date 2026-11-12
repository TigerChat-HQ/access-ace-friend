-- Allow Tiger AI to mark a member's comment as liked while preserving
-- the identity rules for member comments and Tiger AI replies.
ALTER TABLE public.tiger_ai_smart_card_comments
  DROP CONSTRAINT IF EXISTS tiger_ai_smart_card_comment_identity;

ALTER TABLE public.tiger_ai_smart_card_comments
  ADD CONSTRAINT tiger_ai_smart_card_comment_identity CHECK (
    (is_tiger_ai = false AND user_id IS NOT NULL AND mentioned_user_id IS NULL)
    OR (is_tiger_ai = true AND user_id IS NULL AND ai_liked = false)
  );
