create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

-- Keep secrets in Supabase Vault; never expose the webhook secret to browser clients.
create or replace function public.notify_callee_of_call()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  function_url text;
  webhook_secret text;
begin
  if new.signal_type <> 'offer' or new.status <> 'pending' then
    return new;
  end if;

  select decrypted_secret into function_url
  from vault.decrypted_secrets
  where name = 'call_push_function_url'
  limit 1;

  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'call_push_webhook_secret'
  limit 1;

  -- A missing secret should not prevent WebRTC signaling from working.
  if function_url is null or webhook_secret is null then
    raise warning 'Call push is not configured; add the required Supabase Vault secrets.';
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-call-push-secret', webhook_secret
    ),
    body := jsonb_build_object('signal_id', new.id)
  );
  return new;
end;
$$;

revoke all on function public.notify_callee_of_call() from public, anon, authenticated;

drop trigger if exists call_offer_push_notification on public.call_signals;
create trigger call_offer_push_notification
after insert on public.call_signals
for each row execute function public.notify_callee_of_call();
