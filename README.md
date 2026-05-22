# ask_haishin

ログイン不要のライブチャットMVP。Bunny Stream の HLS を擬似ライブ再生し、Supabase Realtime でチャットを同期する。

## 技術構成

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Realtime)
- Bunny Stream（MP4 をアップするだけで HLS 配信。`hls.js` で擬似ライブ再生）
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

### 配信動画の準備（Bunny Stream）

1. https://bunny.net にサインアップ
2. ダッシュボード **Stream → Add Stream Library** で Library を作成
   - レプリケーションリージョンに「Asia (Japan)」を含めると国内視聴が高速
3. Library を開いて **Upload Videos** から MP4 をアップロード
4. ステータスが `Finished` になったら動画詳細の **API** タブで HLS URL をコピー

   ```
   https://vz-<library-hash>.b-cdn.net/<video-guid>/playlist.m3u8
   ```

5. Supabase の `streams` テーブルに行を追加

   ```sql
   insert into streams (title, start_at, hls_url, status)
   values (
     '5月22日 配信',
     '2026-05-22 20:00:00+09',
     'https://vz-abcdef12-345.b-cdn.net/01234567-89ab-cdef-0123-456789abcdef/playlist.m3u8',
     'waiting'
   );
   ```

Bunny 側で HLS 変換・CDN 配信・CORS（`Access-Control-Allow-Origin: *`）がすべて自動で行われるため、ffmpeg やストレージ運用は不要。

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
