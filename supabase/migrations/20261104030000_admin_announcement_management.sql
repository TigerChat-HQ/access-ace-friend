-- Allow administrators to manage the complete announcement history.
-- Regular users continue to see only active, currently scheduled announcements.

drop policy if exists "Read active announcements" on public.announcements;
drop policy if exists "Admins read all announcements" on public.announcements;
drop policy if exists "Users read active announcements" on public.announcements;

create policy "Admins read all announcements" on public.announcements
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'superior_admin'));

create policy "Users read active announcements" on public.announcements
  for select to authenticated
  using (is_active and starts_at <= now() and (expires_at is null or expires_at > now()));
