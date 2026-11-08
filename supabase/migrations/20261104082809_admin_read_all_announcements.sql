DROP POLICY IF EXISTS "Admins view all announcements" ON public.announcements;
CREATE POLICY "Admins view all announcements" ON public.announcements FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));