-- 配信ごとのURL（slug）とチャット分離（stream_id）

-- streams.slug: 視聴ページのパスに使う短いランダムID
alter table public.streams add column if not exists slug text;

-- 既存行のバックフィル（UUIDの先頭8文字）
update public.streams
set slug = substring(replace(id::text, '-', ''), 1, 8)
where slug is null;

alter table public.streams alter column slug set not null;

create unique index if not exists streams_slug_unique
  on public.streams (slug);

-- messages.stream_id: どの配信のチャットか
alter table public.messages
  add column if not exists stream_id uuid
  references public.streams(id) on delete cascade;

create index if not exists messages_stream_created_idx
  on public.messages (stream_id, created_at desc);

-- 一般ユーザーの INSERT に stream_id 必須を追加
drop policy if exists "messages_insert_anon_user" on public.messages;
create policy "messages_insert_anon_user"
  on public.messages
  for insert
  with check (role = 'user' and stream_id is not null);
