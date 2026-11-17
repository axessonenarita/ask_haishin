-- 祝詞アプリ（/norito）用のテーブル
-- 読み取り：会員限定でない行は誰でも読める（anon）。会員限定の行は API（service_role）経由でだけ返す。
-- 書き込み：すべて service_role（管理画面・API）経由。

-- 祝詞（本文は1行1句。行頭に「12.5|」のように秒を書くと、その秒で行が光る）
create table if not exists public.norito_prayers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body text not null default '',
  audio_url text,
  note text,
  members_only boolean not null default false,
  sort integer not null default 100,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

-- 週1回の便り
create table if not exists public.norito_letters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  published_at timestamptz not null default now(),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists norito_letters_published_idx on public.norito_letters (published_at desc);

-- 予定（毎週土日21:00の奏上会は自動で並ぶので、ここには特別な回だけ入れる）
create table if not exists public.norito_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_at timestamptz not null,
  place text not null default 'youtube' check (place in ('youtube','salon','other')),
  url text,
  note text,
  notify boolean not null default true,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists norito_events_start_idx on public.norito_events (start_at);

-- 弥栄の記をもとにした動画の目録
create table if not exists public.norito_videos (
  id uuid primary key default gen_random_uuid(),
  chapter text not null default '',          -- 弥栄の記の章・回（例：第二話 声が戻った夜）
  title text not null,
  aired_on date,
  kind text not null default 'other',        -- soujoukai / reading / iyasaka / other
  people text[] not null default '{}',       -- アスク・ヒロ・相観・スーリヤ など
  summary text,
  youtube_url text,
  salon_url text,
  members_only boolean not null default false,
  sort integer not null default 100,
  created_at timestamptz not null default now()
);
create index if not exists norito_videos_aired_idx on public.norito_videos (aired_on desc);

-- サロンの新着の題名（本文は入れない）
create table if not exists public.norito_salon_posts (
  id text primary key,                       -- DMM の投稿 ID
  title text not null,
  author text,
  posted_at timestamptz not null,
  url text
);
create index if not exists norito_salon_posts_posted_idx on public.norito_salon_posts (posted_at desc);

-- 通知の宛先（ブラウザの購読情報だけ。名前やメールは持たない）
create table if not exists public.norito_push_subs (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  member boolean not null default false,
  device_id text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- 数えるための記録（open=開いた, standalone=ホーム画面から開いた, push_on=通知オン, salon_click=サロンへ）
create table if not exists public.norito_hits (
  id bigserial primary key,
  kind text not null,
  device_id text not null,
  member boolean not null default false,
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists norito_hits_kind_created_idx on public.norito_hits (kind, created_at desc);

-- 設定（member_key＝会員用URLの鍵、salon_url など）。anon からは読めない。
create table if not exists public.norito_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.norito_prayers enable row level security;
alter table public.norito_letters enable row level security;
alter table public.norito_events enable row level security;
alter table public.norito_videos enable row level security;
alter table public.norito_salon_posts enable row level security;
alter table public.norito_push_subs enable row level security;
alter table public.norito_hits enable row level security;
alter table public.norito_settings enable row level security;

drop policy if exists "norito_prayers_public" on public.norito_prayers;
create policy "norito_prayers_public" on public.norito_prayers
  for select using (published and not members_only);

drop policy if exists "norito_letters_public" on public.norito_letters;
create policy "norito_letters_public" on public.norito_letters
  for select using (published_at <= now());

drop policy if exists "norito_events_public" on public.norito_events;
create policy "norito_events_public" on public.norito_events
  for select using (true);

drop policy if exists "norito_videos_public" on public.norito_videos;
create policy "norito_videos_public" on public.norito_videos
  for select using (not members_only);

drop policy if exists "norito_salon_posts_public" on public.norito_salon_posts;
create policy "norito_salon_posts_public" on public.norito_salon_posts
  for select using (true);
-- push_subs / hits / settings は anon に何も許さない（service_role のみ）
