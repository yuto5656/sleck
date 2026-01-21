# Sleck セットアップガイド

## 前提条件

- Node.js 18以上
- Docker & Docker Compose（PostgreSQL用）

## セットアップ手順

### 1. PostgreSQL起動

```bash
# プロジェクトルートで実行
docker-compose up -d
```

PostgreSQLが `localhost:5432` で起動します。

### 2. サーバーセットアップ

```bash
# serverディレクトリに移動
cd server

# 依存関係インストール
npm install

# Prismaクライアント生成
npm run db:generate

# データベースマイグレーション実行
npm run db:migrate
```

### 3. クライアントセットアップ

```bash
# clientディレクトリに移動
cd ../client

# 依存関係インストール
npm install
```

### 4. 開発サーバー起動

**方法1: 個別に起動**

```bash
# ターミナル1: サーバー起動
cd server
npm run dev

# ターミナル2: クライアント起動
cd client
npm run dev
```

**方法2: ルートから同時起動**

```bash
# プロジェクトルートで
npm install  # concurrentlyをインストール
npm run dev
```

### 5. アクセス

- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:3001/api/v1

## 環境変数

サーバーの環境変数は `server/.env` に設定済みです。

本番環境では以下を必ず変更してください：
- `JWT_SECRET` - 強力なランダム文字列に変更
- `JWT_REFRESH_SECRET` - 強力なランダム文字列に変更
- `DATABASE_URL` - 本番データベースのURLに変更

## 便利なコマンド

### データベース管理

```bash
cd server

# Prisma Studio（GUI）を開く
npm run db:studio

# マイグレーション作成
npx prisma migrate dev --name <migration_name>

# データベースリセット
npx prisma migrate reset
```

### Docker

```bash
# PostgreSQL停止
docker-compose down

# PostgreSQL停止（データも削除）
docker-compose down -v

# ログ確認
docker-compose logs -f
```

## トラブルシューティング

### ポート競合

他のアプリケーションがポートを使用している場合：
- フロントエンド(5173): `client/vite.config.ts` の `server.port` を変更
- バックエンド(3001): `server/.env` の `PORT` を変更
- PostgreSQL(5432): `docker-compose.yml` のポートマッピングを変更

### データベース接続エラー

1. Dockerが起動しているか確認
2. `docker-compose ps` でPostgreSQLが動作中か確認
3. `server/.env` の `DATABASE_URL` が正しいか確認

### Prismaエラー

```bash
# クライアント再生成
npx prisma generate

# マイグレーションリセット
npx prisma migrate reset
```
