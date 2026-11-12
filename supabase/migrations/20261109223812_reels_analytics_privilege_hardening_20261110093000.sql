-- Tighten table privileges for Reels tables created with broad project default grants.
-- RLS remains enabled; this also enforces least privilege at the SQL GRANT layer.
REVOKE ALL ON TABLE public.reel_drafts FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reel_drafts TO authenticated;

REVOKE ALL ON TABLE public.post_analytics_events FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT ON TABLE public.post_analytics_events TO authenticated;

