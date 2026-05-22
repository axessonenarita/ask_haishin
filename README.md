# ask_haishin

ログイン不要のライブチャットMVP。Vimeo埋め込み映像 + Supabase Realtimeチャット。

## 技術構成

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Realtime)
- Vimeo iframe 埋め込み
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
| `NEXT_PUBLIC_VIMEO_EMBED_URL` | Vimeo ライブ埋め込みURL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 管理画面API用 service role key |
| `ADMIN_USERNAME` | 管理画面 Basic認証ユーザー |
| `ADMIN_PASSWORD` | 管理画面 Basic認証パスワード |

### DB

`supabase/migrations/0001_init.sql` を Supabase SQL Editor で実行すると、`messages` テーブル・RLS・Realtime 設定が作成される。

## ページ

- `/` — ライブ視聴 + チャット（PC: 左映像/右チャット、SP: 上映像/下チャット）
- `/admin` — Basic認証付き管理画面（運営/STAFF 投稿、コメント削除）

## 機能

- 初回アクセスで ニックネーム / アイコン / カラー を選択（localStorageに保存）
- ログイン不要でコメント投稿
- Supabase Realtime によるリアルタイム反映
- 5秒以内の連投制限（localStorage）
- フロント側 NGワードチェック
- 運営 / STAFF バッジ
- 設定変更ボタンで再設定可能
- 削除は物理削除ではなく `deleted = true`
