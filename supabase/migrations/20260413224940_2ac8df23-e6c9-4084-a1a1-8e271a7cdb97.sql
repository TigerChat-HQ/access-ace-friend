
-- Fix permissive conversation INSERT policy
DROP POLICY "Users create conversations" ON public.conversations;
CREATE POLICY "Authenticated users create conversations" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix permissive conversation_members INSERT policy
DROP POLICY "Users add members" ON public.conversation_members;
CREATE POLICY "Authenticated users add members" ON public.conversation_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix storage listing policies - scope to authenticated users
DROP POLICY "Public avatar access" ON storage.objects;
CREATE POLICY "Authenticated avatar access" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

DROP POLICY "Public story access" ON storage.objects;
CREATE POLICY "Authenticated story access" ON storage.objects FOR SELECT
  USING (bucket_id = 'stories' AND auth.role() = 'authenticated');

DROP POLICY "Public chat media access" ON storage.objects;
CREATE POLICY "Authenticated chat media access" ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-media' AND auth.role() = 'authenticated');
