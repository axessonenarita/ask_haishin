-- Live chat MVP schema
create extension if not exists "pgcrypto";

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  avatar text not null,
  color text not null,
  body text not null,
  role text not null default 'user' check (role in ('user','staff','admin')),
  created_at timestamptz not null default now(),
  deleted boolean not null default false
);

create index if not exists messages_created_at_idx
  on public.messages (created_at desc);

create index if not exists messages_visible_idx
  on public.messages (created_at desc) where deleted = false;

alter table public.messages enable row level security;

-- SELECT: 全員許可。deleted = false のみ表示
drop policy if exists "messages_select_visible" on public.messages;
create policy "messages_select_visible"
  on public.messages
  for select
  using (deleted = false);

-- INSERT: 全員許可。ただし anon は role = 'user' に限定
drop policy if exists "messages_insert_anon_user" on public.messages;
create policy "messages_insert_anon_user"
  on public.messages
  for insert
  with check (role = 'user');

-- UPDATE / DELETE は service_role 経由のみ（ポリシー無しで遮断）

-- Realtime 配信を有効化
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;
