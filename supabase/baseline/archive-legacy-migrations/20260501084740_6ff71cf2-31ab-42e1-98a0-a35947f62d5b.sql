-- Append-only audit log for AI Concierge tool-calling proposals & commits
create table if not exists public.trade_concierge_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  status text not null default 'proposed',
  resulting_resource_id uuid,
  resulting_resource_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_concierge_actions_user
  on public.trade_concierge_actions (user_id, created_at desc);

alter table public.trade_concierge_actions enable row level security;

create policy "Users see their own concierge actions"
  on public.trade_concierge_actions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert their own concierge actions"
  on public.trade_concierge_actions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Admins view all concierge actions"
  on public.trade_concierge_actions for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));