# ask_haishin

ログイン不要のライブチャットMVP。Cloudflare R2上のHLS動画を擬似ライブ再生し、Supabase Realtimeでチャットを同期する。

## 技術構成

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Realtime)
- Cloudflare R2 + HLS（hls.js による擬似ライブ再生）
- 管理画面は Basic 認証 (middleware)

## セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local に必要な値を設定
npm run dev
```

### 環境変数

| 変数 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 管理画面API用 service role key |
| `ADMIN_USERNAME` | 管理画面 Basic認証ユーザー |
| `ADMIN_PASSWORD` | 管理画面 Basic認証パスワード |

### DB

Supabase SQL Editor で以下を順に実行する。

1. `supabase/migrations/0001_init.sql` — `messages` テーブル・RLS・Realtime
2. `supabase/migrations/0002_streams.sql` — `streams` テーブル・RLS

### 配信動画の準備

MP4 を HLS に変換して R2 に配置する。

```bash
ffmpeg -i input.mp4 \
  -codec: copy \
  -start_number 0 \
  -hls_time 10 \
  -hls_list_size 0 \
  -f hls index.m3u8
```

R2 バケットに `streams/2026-05-22/index.m3u8` のような構成でアップロードし、CDN公開URLを `streams.hls_url` に登録する。

```sql
insert into streams (title, start_at, hls_url, status)
values (
  '2026/05/22 配信',
  '2026-05-22 20:00:00+09',
  'https://<r2-public-domain>/streams/2026-05-22/index.m3u8',
  'waiting'
);
```

## 擬似ライブの仕様

- 開始時刻（`start_at`）を基準に `(now - start_at)` 秒の位置から再生
- 再生中は 15 秒ごとに時刻と再生位置を比較し、5 秒以上ズレたら再同期
- シークバーや標準コントロールは非表示
- 初回は「配信に参加」ボタン押下で再生開始（スマホ自動再生制限対策）
- 状態は `status` と `start_at` から導出
  - `status='ended'` → 「配信は終了しました」
  - `now < start_at` → 「まもなく開始します」
  - 上記以外 → ライブ再生

## ページ

- `/` — ライブ視聴 + チャット（PC: 左映像/右チャット、SP: 上映像/下チャット）
- `/admin` — Basic認証付き管理画面（運営/STAFF 投稿、コメント削除）

## チャット機能

- 初回アクセスで ニックネーム / アイコン / カラー を選択（localStorageに保存）
- ログイン不要でコメント投稿
- Supabase Realtime によるリアルタイム反映
- 5秒以内の連投制限（localStorage）
- フロント側 NGワードチェック
- 運営 / STAFF バッジ
- 設定変更ボタンで再設定可能
- 削除は物理削除ではなく `deleted = true`
