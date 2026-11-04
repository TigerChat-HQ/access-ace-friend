-- Tiger AI Command Center task planning and audit tables.
-- Safe to apply once through Supabase migrations.

create table if not exists public.dev_tasks (
  id uuid primary key default gen_random_uuid(),
  source_report_id uuid,
  title text not null,
  summary text,
  category text not null default 'feature',
  priority text not null default 'medium',
  risk text not null default 'low',
  status text not null default 'planned',
  plan jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dev_tasks_created_at_idx on public.dev_tasks (created_at desc);
create index if not exists dev_tasks_source_report_id_idx on public.dev_tasks (source_report_id);

grant select, insert, update, delete on public.dev_tasks to authenticated;
grant all on public.dev_tasks to service_role;
alter table public.dev_tasks enable row level security;

drop policy if exists "Admins manage dev tasks" on public.dev_tasks;
create policy "Admins manage dev tasks" on public.dev_tasks
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'superior_admin'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'superior_admin'));

create table if not exists public.dev_audit_log (
  id uuid primary key default gen_random_uuid(),
  task_id uuid,
  actor text not null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists dev_audit_log_created_at_idx on public.dev_audit_log (created_at desc);
grant select on public.dev_audit_log to authenticated;
grant all on public.dev_audit_log to service_role;
alter table public.dev_audit_log enable row level security;

drop policy if exists "Admins read audit" on public.dev_audit_log;
create policy "Admins read audit" on public.dev_audit_log
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'superior_admin'));
