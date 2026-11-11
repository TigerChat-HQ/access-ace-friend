ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS hide_like_count boolean NOT NULL DEFAULT false;
