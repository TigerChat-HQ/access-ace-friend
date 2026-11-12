-- Engagement for Tiger AI-generated Books Smart Cards (posts and statuses).
ALTER TABLE public.tiger_ai_daily_comments ADD COLUMN IF NOT EXISTS mentioned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS public.tiger_ai_smart_card_likes (
  card_id uuid NOT NULL REFERENCES public.tiger_ai_smart_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, user_id)
);
ALTER TABLE public.tiger_ai_smart_card_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tiger_ai_smart_card_likes FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.tiger_ai_smart_card_likes TO authenticated;
DROP POLICY IF EXISTS "Users read Smart Card likes" ON public.tiger_ai_smart_card_likes;
CREATE POLICY "Users read Smart Card likes" ON public.tiger_ai_smart_card_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users add own Smart Card likes" ON public.tiger_ai_smart_card_likes;
CREATE POLICY "Users add own Smart Card likes" ON public.tiger_ai_smart_card_likes FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users remove own Smart Card likes" ON public.tiger_ai_smart_card_likes;
CREATE POLICY "Users remove own Smart Card likes" ON public.tiger_ai_smart_card_likes FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE TABLE IF NOT EXISTS public.tiger_ai_smart_card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.tiger_ai_smart_cards(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.tiger_ai_smart_card_comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mentioned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  is_tiger_ai boolean NOT NULL DEFAULT false,
  ai_liked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tiger_ai_smart_card_comment_identity CHECK (
    (is_tiger_ai = false AND user_id IS NOT NULL AND mentioned_user_id IS NULL AND ai_liked = false)
    OR (is_tiger_ai = true AND user_id IS NULL AND ai_liked = false)
  )
);
CREATE INDEX IF NOT EXISTS tiger_ai_smart_card_comments_card_created_idx
  ON public.tiger_ai_smart_card_comments(card_id, created_at);
CREATE INDEX IF NOT EXISTS tiger_ai_smart_card_comments_parent_idx
  ON public.tiger_ai_smart_card_comments(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS tiger_ai_smart_card_one_ai_reply_per_comment_idx
  ON public.tiger_ai_smart_card_comments(parent_id)
  WHERE is_tiger_ai = true AND parent_id IS NOT NULL;
ALTER TABLE public.tiger_ai_smart_card_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tiger_ai_smart_card_comments FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.tiger_ai_smart_card_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tiger_ai_smart_card_comments TO service_role;
DROP POLICY IF EXISTS "Users read Smart Card comments" ON public.tiger_ai_smart_card_comments;
CREATE POLICY "Users read Smart Card comments" ON public.tiger_ai_smart_card_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users create own Smart Card comments" ON public.tiger_ai_smart_card_comments;
CREATE POLICY "Users create own Smart Card comments" ON public.tiger_ai_smart_card_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()) AND is_tiger_ai = false AND ai_liked = false AND mentioned_user_id IS NULL);

CREATE TABLE IF NOT EXISTS public.tiger_ai_smart_card_comment_likes (
  comment_id uuid NOT NULL REFERENCES public.tiger_ai_smart_card_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
ALTER TABLE public.tiger_ai_smart_card_comment_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tiger_ai_smart_card_comment_likes FROM PUBLIC, anon;
GRANT SELECT, INSERT, DELETE ON public.tiger_ai_smart_card_comment_likes TO authenticated;
DROP POLICY IF EXISTS "Users read Smart Card comment likes" ON public.tiger_ai_smart_card_comment_likes;
CREATE POLICY "Users read Smart Card comment likes" ON public.tiger_ai_smart_card_comment_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users add own Smart Card comment likes" ON public.tiger_ai_smart_card_comment_likes;
CREATE POLICY "Users add own Smart Card comment likes" ON public.tiger_ai_smart_card_comment_likes FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Users remove own Smart Card comment likes" ON public.tiger_ai_smart_card_comment_likes;
CREATE POLICY "Users remove own Smart Card comment likes" ON public.tiger_ai_smart_card_comment_likes FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- Notifications use the existing recipient identity as actor_id for this system event;
-- the UI renders the actor as Tiger AI for this dedicated notification type.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like','comment','follow','mention','reply','comment_like','report_reply',
                  'collaboration_invite','collaboration_accepted','tiger_ai_reply'));

DO $realtime_guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tiger_ai_smart_card_comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tiger_ai_smart_card_comments;
  END IF;
END $realtime_guard$;

