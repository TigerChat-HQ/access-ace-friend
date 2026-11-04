-- Autonomous Tiger AI editor state and audit metadata.
-- Protected by the existing admin-only RLS policies and service-role Edge Function.

create table if not exists public.dev_code_proposals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.dev_tasks(id),
  path text not null,
  base_sha text not null,
  original text not null,
  proposed text not null,
  summary text not null,
  security jsonb not null default '{}'::jsonb,
  status text not null default 'proposed',
  branch text,
  pr_url text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

grant select on public.dev_code_proposals to authenticated;
grant all on public.dev_code_proposals to service_role;
alter table public.dev_code_proposals enable row level security;
drop policy if exists "Admins read code proposals" on public.dev_code_proposals;
create policy "Admins read code proposals" on public.dev_code_proposals for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'superior_admin'));

alter table public.dev_code_proposals
  add column if not exists commit_sha text,
  add column if not exists pr_number integer,
  add column if not exists merge_sha text,
  add column if not exists merged_at timestamptz,
  add column if not exists deployment_status text;

alter table public.dev_code_proposals drop constraint if exists dev_code_proposals_status_check;
alter table public.dev_code_proposals add constraint dev_code_proposals_status_check
  check (status in ('proposed', 'applying', 'failed', 'merged'));

create index if not exists dev_code_proposals_status_idx on public.dev_code_proposals (status, created_at desc);
create index if not exists dev_code_proposals_pr_number_idx on public.dev_code_proposals (pr_number);

comment on table public.dev_code_proposals is 'Audited autonomous Tiger AI changes. Only policy-approved, non-high-risk changes can be merged automatically.';
