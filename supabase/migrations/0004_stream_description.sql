-- 配信概要（description）

alter table public.streams add column if not exists description text;
