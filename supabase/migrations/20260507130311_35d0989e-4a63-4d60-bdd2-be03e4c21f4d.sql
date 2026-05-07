
-- Storage policies for stories and chat-media (idempotent via DO blocks)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Stories public read') THEN
    CREATE POLICY "Stories public read" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Stories user upload') THEN
    CREATE POLICY "Stories user upload" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Stories user delete') THEN
    CREATE POLICY "Stories user delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Chat media public read') THEN
    CREATE POLICY "Chat media public read" ON storage.objects FOR SELECT USING (bucket_id = 'chat-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Chat media user upload') THEN
    CREATE POLICY "Chat media user upload" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Chat media user delete') THEN
    CREATE POLICY "Chat media user delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatars public read') THEN
    CREATE POLICY "Avatars public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatars user upload') THEN
    CREATE POLICY "Avatars user upload" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatars user update') THEN
    CREATE POLICY "Avatars user update" ON storage.objects FOR UPDATE
      USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Add story_reactions to realtime publication (ignore if already there)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.story_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
