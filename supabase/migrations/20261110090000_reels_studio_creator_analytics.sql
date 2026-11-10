-- Reels Studio drafts and first-party creator analytics.
-- Analytics are event-backed: historical reach/watch metrics begin accruing after this migration.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS reel_cover_url text,
  ADD COLUMN IF NOT EXISTS reel_audio_url text,
  ADD COLUMN IF NOT EXISTS reel_audio_title text,
  ADD COLUMN IF NOT EXISTS reel_audio_start_seconds numeric(10,3),
  ADD COLUMN IF NOT EXISTS reel_trim_start_seconds numeric(10,3),
  ADD COLUMN IF NOT EXISTS reel_trim_end_seconds numeric(10,3),
  ADD COLUMN IF NOT EXISTS reel_captions jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.reel_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caption text NOT NULL DEFAULT '',
  source_media_path text,
  cover_path text,
  audio_path text,
  audio_title text,
  audio_start_seconds numeric(10,3) NOT NULL DEFAULT 0,
  trim_start_seconds numeric(10,3) NOT NULL DEFAULT 0,
  trim_end_seconds numeric(10,3),
  captions jsonb NOT NULL DEFAULT '[]'::jsonb,
  editor_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reel_drafts_caption_length CHECK (char_length(caption) <= 2200),
  CONSTRAINT reel_drafts_trim_range CHECK (
    trim_start_seconds >= 0 AND
    (trim_end_seconds IS NULL OR trim_end_seconds > trim_start_seconds)
  ),
  CONSTRAINT reel_drafts_captions_array CHECK (jsonb_typeof(captions) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_reel_drafts_user_updated
  ON public.reel_drafts (user_id, updated_at DESC);

ALTER TABLE public.reel_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators manage their own reel drafts" ON public.reel_drafts;
CREATE POLICY "Creators manage their own reel drafts"
  ON public.reel_drafts
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
REVOKE ALL ON TABLE public.reel_drafts FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reel_drafts TO authenticated;

CREATE TABLE IF NOT EXISTS public.post_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'impression', 'play', 'watch',
    'retention_25', 'retention_50', 'retention_75', 'retention_100'
  )),
  watch_seconds numeric(10,3) NOT NULL DEFAULT 0
    CHECK (watch_seconds >= 0 AND watch_seconds <= 3600),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_analytics_watch_only CHECK (event_type = 'watch' OR watch_seconds = 0)
);

CREATE INDEX IF NOT EXISTS idx_post_analytics_creator_time
  ON public.post_analytics_events (creator_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_post_time
  ON public.post_analytics_events (post_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_analytics_viewer_post
  ON public.post_analytics_events (post_id, viewer_id, occurred_at DESC);

ALTER TABLE public.post_analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators read their post analytics" ON public.post_analytics_events;
CREATE POLICY "Creators read their post analytics"
  ON public.post_analytics_events
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = creator_id);

DROP POLICY IF EXISTS "Viewers record analytics for posts they can see" ON public.post_analytics_events;
CREATE POLICY "Viewers record analytics for posts they can see"
  ON public.post_analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = viewer_id
    AND creator_id <> (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.user_id = creator_id AND p.media_type = 'video'
    )
  );

REVOKE ALL ON TABLE public.post_analytics_events FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT ON public.post_analytics_events TO authenticated;


-- Draft media must never be served from the public post-media bucket.
-- Published Reels are copied to post-media only at the explicit publish step.
INSERT INTO storage.buckets (id, name, public)
VALUES ('reel-drafts', 'reel-drafts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Creators manage their private reel draft assets" ON storage.objects;
CREATE POLICY "Creators manage their private reel draft assets"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'reel-drafts'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
)
WITH CHECK (
  bucket_id = 'reel-drafts'
  AND (storage.foldername(name))[1] = (select auth.uid())::text
);
