-- Allow administrators to view the complete announcement history.
-- The existing public-facing policy intentionally limits regular users to active announcements.
drop policy if exists "Admins read all announcements" on public.announcements;

create policy "Admins read all announcements"
  on public.announcements
  for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'superior_admin')
  );