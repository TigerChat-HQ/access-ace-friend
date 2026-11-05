-- Allow admin roles to manage all announcements while keeping public reads limited to active ones.

DROP POLICY IF EXISTS "Read active announcements" ON public.announcements;

CREATE POLICY "Users view active announcements"
ON public.announcements
FOR SELECT TO authenticated
USING (
  is_active
  AND starts_at <= now()
  AND (expires_at IS NULL OR expires_at > now())
);

CREATE POLICY "Admins view all announcements"
ON public.announcements
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'superior_admin')
);

-- Keep the existing admin create/update/delete policies untouched.
