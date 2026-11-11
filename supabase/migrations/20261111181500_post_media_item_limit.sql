-- Keep carousel limits enforced even for direct API requests that bypass the UI.
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_media_items_max_ten_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_media_items_max_ten_check
  CHECK (jsonb_typeof(media_items) = 'array' AND jsonb_array_length(media_items) <= 10);
