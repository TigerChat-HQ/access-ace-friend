DROP VIEW IF EXISTS public.trending_posts;
CREATE VIEW public.trending_posts WITH (security_invoker = true) AS
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