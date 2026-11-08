-- Publish story view inserts so owners receive live view-count updates.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
