-- Tiger Reels creator suite: reusable audio, remix attribution and scheduled Reel visibility.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS reel_audio_end_seconds numeric(10,3),
  ADD COLUMN IF NOT EXISTS reel_original_volume numeric(3,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reel_music_volume numeric(3,2) NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS reel_audio_shareable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reel_original_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reel_remix_type text;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_reel_remix_type_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_reel_remix_type_check
  CHECK (reel_remix_type IS NULL OR reel_remix_type IN ('remix', 'duet'));

CREATE INDEX IF NOT EXISTS idx_posts_shared_reel_audio
  ON public.posts(created_at DESC)
  WHERE media_type = 'video'
    AND reel_audio_shareable = true
    AND reel_audio_url IS NOT NULL
    AND audience = 'public'
    AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_reel_remix_source
  ON public.posts(reel_original_post_id, created_at DESC)
  WHERE reel_remix_type = 'remix' AND reel_original_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_creator_scheduled_reels
  ON public.posts(user_id, scheduled_at)
  WHERE media_type = 'video' AND is_draft = false AND scheduled_at IS NOT NULL;

-- A creator may see their own scheduled Reels before the public release time.
DROP POLICY IF EXISTS "Creators read their own scheduled reels" ON public.posts;
CREATE POLICY "Creators read their own scheduled reels"
  ON public.posts
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    AND media_type = 'video'
    AND is_draft = false
    AND scheduled_at IS NOT NULL
    AND scheduled_at > now()
  );

CREATE TABLE IF NOT EXISTS public.reel_audio_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_url text NOT NULL,
  audio_title text NOT NULL DEFAULT 'Original audio',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reel_audio_saves_user_source_key UNIQUE (user_id, source_post_id)
);
CREATE INDEX IF NOT EXISTS idx_reel_audio_saves_user_created
  ON public.reel_audio_saves(user_id, created_at DESC);
ALTER TABLE public.reel_audio_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their saved Reel audio" ON public.reel_audio_saves;
CREATE POLICY "Users manage their saved Reel audio"
  ON public.reel_audio_saves
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
REVOKE ALL ON TABLE public.reel_audio_saves FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, DELETE ON TABLE public.reel_audio_saves TO authenticated;

CREATE TABLE IF NOT EXISTS public.reel_follow_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attributed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reel_follow_attributions_unique_follow UNIQUE (reel_id, follower_id),
  CONSTRAINT reel_follow_attributions_not_self CHECK (creator_id <> follower_id)
);
CREATE INDEX IF NOT EXISTS idx_reel_follow_attributions_creator_time
  ON public.reel_follow_attributions(creator_id, attributed_at DESC);
ALTER TABLE public.reel_follow_attributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators read Reel follow conversions" ON public.reel_follow_attributions;
CREATE POLICY "Creators read Reel follow conversions"
  ON public.reel_follow_attributions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = creator_id);
DROP POLICY IF EXISTS "Followers attribute a follow to a Reel" ON public.reel_follow_attributions;
CREATE POLICY "Followers attribute a follow to a Reel"
  ON public.reel_follow_attributions
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = follower_id
    AND EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = (select auth.uid())
        AND f.following_id = creator_id
    )
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = reel_id
        AND p.user_id = creator_id
        AND p.media_type = 'video'
        AND p.is_draft = false
        AND (p.scheduled_at IS NULL OR p.scheduled_at <= now())
    )
  );
REVOKE ALL ON TABLE public.reel_follow_attributions FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT ON TABLE public.reel_follow_attributions TO authenticated;

-- Count a replay separately from the first play for creator analytics.
ALTER TABLE public.post_analytics_events
  DROP CONSTRAINT IF EXISTS post_analytics_events_event_type_check;
ALTER TABLE public.post_analytics_events
  ADD CONSTRAINT post_analytics_events_event_type_check
  CHECK (event_type IN (
    'impression', 'play', 'replay', 'watch',
    'retention_25', 'retention_50', 'retention_75', 'retention_100'
  ));

-- Preserve the selected music clip range in saved drafts as well as published Reels.
ALTER TABLE IF EXISTS public.reel_drafts
  ADD COLUMN IF NOT EXISTS audio_end_seconds numeric(10,3),
  ADD COLUMN IF NOT EXISTS original_volume numeric(3,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS music_volume numeric(3,2) NOT NULL DEFAULT 0.75;
