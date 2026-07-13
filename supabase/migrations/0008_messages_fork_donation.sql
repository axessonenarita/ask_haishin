-- 奉納音叉 (課金音叉) 用のカラム追加
-- fork_amount = 0 は通常コメント。>0 は奉納コメント(Stripe 決済経由のみ)
-- stripe_session_id は webhook 冪等性を担保するための UNIQUE キー
alter table public.messages
  add column if not exists fork_amount integer not null default 0,
  add column if not exists stripe_session_id text;

alter table public.messages
  add constraint messages_fork_amount_nonneg check (fork_amount >= 0);

create unique index if not exists messages_stripe_session_id_unique
  on public.messages(stripe_session_id)
  where stripe_session_id is not null;

create index if not exists messages_stream_fork_idx
  on public.messages(stream_id, fork_amount)
  where fork_amount > 0;

-- 匿名クライアントは fork_amount > 0 を絶対に挿入できないようにする。
-- 奉納メッセージは webhook (service_role) だけが insert する
drop policy if exists "messages_insert_anon_user" on public.messages;
create policy "messages_insert_anon_user"
  on public.messages
  for insert
  with check (role = 'user' and fork_amount = 0 and stripe_session_id is null);
