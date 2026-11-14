-- Private, per-user transcripts for voice notes. Audio is never stored in this table.
create table if not exists public.voice_note_transcripts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  transcriber_id uuid not null references auth.users(id) on delete cascade,
  transcript text not null check (char_length(transcript) between 1 and 12000),
  language text check (language is null or char_length(language) <= 32),
  provider text not null default 'gemini-3.5-flash-lite',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_note_transcripts_message_user_unique unique (message_id, transcriber_id)
);

alter table public.voice_note_transcripts enable row level security;
grant select, insert, update, delete on public.voice_note_transcripts to authenticated;

drop policy if exists "Users read their own voice note transcripts" on public.voice_note_transcripts;
create policy "Users read their own voice note transcripts"
on public.voice_note_transcripts for select to authenticated
using (transcriber_id = (select auth.uid()));

drop policy if exists "Users create their own voice note transcripts" on public.voice_note_transcripts;
create policy "Users create their own voice note transcripts"
on public.voice_note_transcripts for insert to authenticated
with check (
  transcriber_id = (select auth.uid())
  and exists (
    select 1 from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = message_id
      and m.conversation_id = voice_note_transcripts.conversation_id
      and m.message_type = 'voice'
      and cm.user_id = (select auth.uid())
  )
);

drop policy if exists "Users update their own voice note transcripts" on public.voice_note_transcripts;
create policy "Users update their own voice note transcripts"
on public.voice_note_transcripts for update to authenticated
using (transcriber_id = (select auth.uid()))
with check (
  transcriber_id = (select auth.uid())
  and exists (
    select 1 from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = message_id
      and m.conversation_id = voice_note_transcripts.conversation_id
      and m.message_type = 'voice'
      and cm.user_id = (select auth.uid())
  )
);

drop policy if exists "Users delete their own voice note transcripts" on public.voice_note_transcripts;
create policy "Users delete their own voice note transcripts"
on public.voice_note_transcripts for delete to authenticated
using (transcriber_id = (select auth.uid()));
