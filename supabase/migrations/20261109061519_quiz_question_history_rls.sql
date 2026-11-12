
create table if not exists public.quiz_question_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  created_at timestamptz not null default now()
);
create index if not exists quiz_question_history_user_created_idx
  on public.quiz_question_history(user_id, created_at desc);
alter table public.quiz_question_history enable row level security;
revoke all on public.quiz_question_history from anon;
grant select on public.quiz_question_history to authenticated;
grant all on public.quiz_question_history to service_role;
drop policy if exists "Own quiz history" on public.quiz_question_history;
create policy "Own quiz history"
  on public.quiz_question_history for select
  to authenticated
  using ((select auth.uid()) = user_id);

