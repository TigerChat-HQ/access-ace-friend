-- Phase 5: chat preferences
CREATE TABLE IF NOT EXISTS public.chat_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  wallpaper TEXT,
  bubble_color TEXT,
  font_size TEXT DEFAULT 'medium',
  theme TEXT DEFAULT 'default',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, conversation_id)
);
ALTER TABLE public.chat_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own chat prefs" ON public.chat_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own chat prefs" ON public.chat_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own chat prefs" ON public.chat_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own chat prefs" ON public.chat_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Phase 6: stories upgrade
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS duration INTEGER,
  ADD COLUMN IF NOT EXISTS text_overlay JSONB;

CREATE TABLE IF NOT EXISTS public.story_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id, emoji)
);
ALTER TABLE public.story_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Story reactions viewable by story owner or self" ON public.story_reactions
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_reactions.story_id AND s.user_id = auth.uid())
  );
CREATE POLICY "Users react as self" ON public.story_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own reactions" ON public.story_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Phase 7: trending view
CREATE OR REPLACE VIEW public.trending_posts AS
SELECT
  p.id,
  p.user_id,
  p.created_at,
  COALESCE(l.like_count, 0) AS like_count,
  COALESCE(c.comment_count, 0) AS comment_count,
  (
    COALESCE(l.like_count, 0) * 1.0
    + COALESCE(c.comment_count, 0) * 2.0
  ) / GREATEST(EXTRACT(EPOCH FROM (now() - p.created_at)) / 3600.0 + 2.0, 1.0) AS score
FROM public.posts p
LEFT JOIN (SELECT post_id, COUNT(*) AS like_count FROM public.post_likes GROUP BY post_id) l ON l.post_id = p.id
LEFT JOIN (SELECT post_id, COUNT(*) AS comment_count FROM public.post_comments GROUP BY post_id) c ON c.post_id = p.id
WHERE p.created_at > now() - INTERVAL '7 days';

GRANT SELECT ON public.trending_posts TO authenticated;