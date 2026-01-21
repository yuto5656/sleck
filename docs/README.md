# Sleck - Slack風メッセージングアプリケーション

## プロジェクト概要

Sleckは、SlackをモデルにしたリアルタイムメッセージングWebアプリケーションです。

## ドキュメント一覧

- [設計書](./design.md) - システム全体の設計
- [API仕様書](./api-spec.md) - REST API仕様
- [データベース設計書](./database.md) - DB スキーマ設計
- [機能仕様書](./features.md) - 機能詳細

## 技術スタック

### フロントエンド
- React 18 + TypeScript
- Vite（ビルドツール）
- TailwindCSS（スタイリング）
- Socket.io-client（リアルタイム通信）
- React Router（ルーティング）
- Zustand（状態管理）

### バックエンド
- Node.js + TypeScript
- Express.js（REST API）
- Socket.io（WebSocket）
- Prisma（ORM）
- PostgreSQL（データベース）
- JWT（認証）

## ディレクトリ構成

```
sleck/
├── docs/                    # ドキュメント
├── client/                  # フロントエンド
│   ├── src/
│   │   ├── components/      # UIコンポーネント
│   │   ├── pages/           # ページコンポーネント
│   │   ├── hooks/           # カスタムフック
│   │   ├── stores/          # 状態管理
│   │   ├── services/        # API通信
│   │   ├── types/           # 型定義
│   │   └── utils/           # ユーティリティ
│   └── public/
├── server/                  # バックエンド
│   ├── src/
│   │   ├── controllers/     # コントローラー
│   │   ├── services/        # ビジネスロジック
│   │   ├── routes/          # ルーティング
│   │   ├── middleware/      # ミドルウェア
│   │   ├── socket/          # WebSocket処理
│   │   ├── types/           # 型定義
│   │   └── utils/           # ユーティリティ
│   └── prisma/              # Prismaスキーマ・マイグレーション
└── shared/                  # 共通型定義
```

## セットアップ

```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm run dev

# データベースマイグレーション
npm run db:migrate
```
