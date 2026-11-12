DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
