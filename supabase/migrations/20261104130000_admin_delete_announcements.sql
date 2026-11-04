-- Permit only administrators to permanently delete announcements.
-- The existing admin SELECT policy allows admins to target the full history;
-- regular users retain read-only access to active, scheduled announcements.

drop policy if exists "Admins delete announcements" on public.announcements;

create policy "Admins delete announcements"
  on public.announcements
  for delete
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'superior_admin')
  );
