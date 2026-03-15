# Discord Countdown Bot

ボイスチャンネル常駐 & リアルタイムカウントダウン画像を生成する Discord Bot です。

---

## コマンド一覧

| コマンド | 説明 |
|---|---|
| `/countdown time:<HH:MM> channel:<#ch> [design:<1-10>]` | 指定時刻までのカウントダウンを開始 |
| `/join [channel:<VC>]` | ボイスチャンネルに常駐接続 |
| `/leave` | ボイスチャンネルから退出 |

### デザイン一覧（1〜10）

| # | 名前 |
|---|---|
| 1 | Minimal Dark |
| 2 | Neon Cyber |
| 3 | Sunset |
| 4 | Space |
| 5 | Matrix |
| 6 | Ocean |
| 7 | Fire |
| 8 | Aurora |
| 9 | Retro |
| 10 | Minimal Light |

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env` にコピーして値を記入します。

```bash
cp .env.example .env
```

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
GUILD_ID=your_guild_id_here        # テスト用ギルドID（省略でグローバル登録）
RENDER_URL=https://your-app.onrender.com
```

### 3. Bot に付与が必要な権限

Discord Developer Portal の OAuth2 設定で以下を有効化:

**Scopes:** `bot`, `applications.commands`

**Bot Permissions:**
- Send Messages
- Attach Files
- Read Message History
- Connect (Voice)
- Speak (Voice)

**Privileged Gateway Intents:**
- Message Content Intent

### 4. スラッシュコマンドの登録

```bash
npm run deploy
```

`GUILD_ID` を設定すると即時反映、省略すると最大1時間かかるグローバル登録になります。

### 5. 起動

```bash
npm start
```

---

## Render へのデプロイ

1. このリポジトリを GitHub にプッシュ
2. [Render](https://render.com) で **New Web Service** を作成
3. リポジトリを接続し、`render.yaml` の設定が自動で読み込まれます
4. **Environment Variables** に `.env` の値を設定
5. Deploy

> **注意:** `RENDER_URL` に Render が発行したサービスの URL を設定してください。  
> Bot は 4 分ごとに自分自身を叩いてスリープを防ぎます。

---

## 注意事項

- カウントダウンは **10 秒ごと** にメッセージを更新します
- 目標時刻が過去の場合は自動的に **翌日** にスケジュールされます
- `@discordjs/voice` は音声の送受信ライブラリです。`/join` で常駐する際はミュート状態で接続します
