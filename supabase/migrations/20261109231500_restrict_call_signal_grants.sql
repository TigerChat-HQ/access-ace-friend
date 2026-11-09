-- call_signals is an authenticated append-only signaling channel.
-- Remove broad default/table grants (including TRUNCATE, which bypasses RLS).
revoke all privileges on table public.call_signals from public, anon, authenticated;
grant select, insert on table public.call_signals to authenticated;
