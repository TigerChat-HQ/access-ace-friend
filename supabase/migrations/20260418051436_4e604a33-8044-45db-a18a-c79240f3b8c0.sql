
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Actors create notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);
