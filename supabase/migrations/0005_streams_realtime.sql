-- streams テーブルを Realtime publication に追加
-- (管理画面での更新を視聴ページへ即時反映するため)

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'streams'
  ) then
    execute 'alter publication supabase_realtime add table public.streams';
  end if;
end $$;
