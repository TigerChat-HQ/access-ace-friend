DROP POLICY IF EXISTS "Admins delete announcements" ON public.announcements;
CREATE POLICY "Admins delete announcements" ON public.announcements FOR DELETE TO authenticated
 USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superior_admin'));