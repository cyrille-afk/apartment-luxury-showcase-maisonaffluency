
create table if not exists public.concierge_stream_sessions (
  stream_id     uuid primary key,
  user_id       uuid not null,
  request_id    text,
  status        text not null default 'in_progress' check (status in ('in_progress','complete','error')),
  surface       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index if not exists idx_concierge_stream_sessions_user_created
  on public.concierge_stream_sessions (user_id, created_at desc);
create index if not exists idx_concierge_stream_sessions_created
  on public.concierge_stream_sessions (created_at);
grant all on public.concierge_stream_sessions to service_role;
alter table public.concierge_stream_sessions enable row level security;

create table if not exists public.concierge_stream_frames (
  stream_id   uuid not null references public.concierge_stream_sessions(stream_id) on delete cascade,
  seq         integer not null,
  chunk       text not null,
  created_at  timestamptz not null default now(),
  primary key (stream_id, seq)
);
create index if not exists idx_concierge_stream_frames_created
  on public.concierge_stream_frames (created_at);
grant all on public.concierge_stream_frames to service_role;
alter table public.concierge_stream_frames enable row level security;

create or replace function public.purge_stale_concierge_streams()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.concierge_stream_sessions
   where created_at < now() - interval '1 hour';
$$;
revoke all on function public.purge_stale_concierge_streams() from public;
grant execute on function public.purge_stale_concierge_streams() to service_role;
