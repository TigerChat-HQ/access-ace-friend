-- First-class post composer metadata (kept separate from Reels Studio).
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_audio_url text,
  ADD COLUMN IF NOT EXISTS post_audio_title text,
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS tagged_user_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alt_text text,
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_audience_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_audience_check CHECK (audience IN ('public', 'followers', 'private'));

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_media_items_array_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_media_items_array_check CHECK (jsonb_typeof(media_items) = 'array');

CREATE INDEX IF NOT EXISTS idx_posts_published_schedule
  ON public.posts (scheduled_at, created_at DESC)
  WHERE is_draft = false;

CREATE TABLE IF NOT EXISTS public.post_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caption text NOT NULL DEFAULT '',
  editor_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  media_paths text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_drafts_editor_state_object CHECK (jsonb_typeof(editor_state) = 'object'),
  CONSTRAINT post_drafts_caption_length CHECK (char_length(caption) <= 2200)
);
CREATE INDEX IF NOT EXISTS idx_post_drafts_user_updated
  ON public.post_drafts (user_id, updated_at DESC);
ALTER TABLE public.post_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own post drafts" ON public.post_drafts;
CREATE POLICY "Users manage their own post drafts"
  ON public.post_drafts FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
REVOKE ALL ON TABLE public.post_drafts FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.post_drafts TO authenticated;

-- Private posts are visible only to their author; followers-only posts require a follow relationship.
DROP POLICY IF EXISTS "Posts viewable by authenticated" ON public.posts;
CREATE POLICY "Posts viewable by audience" ON public.posts
  FOR SELECT TO authenticated
  USING (
    is_draft = false
    AND (scheduled_at IS NULL OR scheduled_at <= now())
    AND (
      user_id = (select auth.uid())
      OR audience = 'public'
      OR (
        audience = 'followers'
        AND EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = (select auth.uid())
            AND f.following_id = posts.user_id
        )
      )
    )
  );
