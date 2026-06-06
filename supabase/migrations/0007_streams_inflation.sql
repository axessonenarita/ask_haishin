-- 視聴者数表示のかさ増し係数(配信ごとに設定可能、null ならクライアント側のデフォルトを使用)

alter table public.streams
  add column if not exists inflation_boost_start integer,
  add column if not exists inflation_real_max integer,
  add column if not exists inflation_target_max integer;
