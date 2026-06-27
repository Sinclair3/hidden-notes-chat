create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  sender text not null,
  type text not null,
  content text not null,
  reply_to uuid null,
  reactions jsonb null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "public messages read" on public.messages
  for select using (true);

create policy "public messages insert" on public.messages
  for insert with check (true);
