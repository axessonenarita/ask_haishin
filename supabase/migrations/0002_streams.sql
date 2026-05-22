-- streams table for pseudo-live HLS playback
create table if not exists public.streams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_at timestamptz not null,
  hls_url text not null,
  status text not null default 'waiting' check (status in ('waiting','live','ended')),
  created_at timestamptz not null default now()
);

create index if not exists streams_start_at_idx
  on public.streams (start_at desc);

alter table public.streams enable row level security;

-- SELECT: 全員許可（一般ユーザーが現在の配信情報を取得できる）
drop policy if exists "streams_select_all" on public.streams;
create policy "streams_select_all"
  on public.streams
  for select
  using (true);

-- INSERT/UPDATE/DELETE は service_role 経由のみ
