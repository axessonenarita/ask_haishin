-- 運営/STAFF コメントを固定表示するかどうかのフラグ
alter table public.messages
  add column if not exists pinned boolean not null default false;
