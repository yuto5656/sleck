# Sleck API仕様書

## 概要

- ベースURL: `/api/v1`
- 認証: JWT Bearer Token
- レスポンス形式: JSON

## 認証ヘッダー

```
Authorization: Bearer <access_token>
```

---

## 1. 認証 API

### POST /auth/register
ユーザー登録

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "displayName": "John Doe"
}
```

**Response: 201 Created**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "avatarUrl": null,
    "status": "online",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

### POST /auth/login
ログイン

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response: 200 OK**
```json
{
  "user": { ... },
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

### POST /auth/refresh
トークンリフレッシュ

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response: 200 OK**
```json
{
  "accessToken": "new_jwt_access_token",
  "refreshToken": "new_jwt_refresh_token"
}
```

### POST /auth/logout
ログアウト

**Response: 204 No Content**

---

## 2. ユーザー API

### GET /users/me
現在のユーザー情報取得

**Response: 200 OK**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "John Doe",
  "avatarUrl": "https://...",
  "status": "online",
  "statusMessage": "Working from home"
}
```

### PATCH /users/me
プロフィール更新

**Request Body:**
```json
{
  "displayName": "New Name",
  "statusMessage": "In a meeting"
}
```

### PATCH /users/me/status
ステータス更新

**Request Body:**
```json
{
  "status": "away"
}
```

### POST /users/me/avatar
アバターアップロード

**Request:** `multipart/form-data`
- `avatar`: 画像ファイル

---

## 3. ワークスペース API

### GET /workspaces
参加ワークスペース一覧

**Response: 200 OK**
```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "My Workspace",
      "slug": "my-workspace",
      "iconUrl": "https://...",
      "role": "owner"
    }
  ]
}
```

### POST /workspaces
ワークスペース作成

**Request Body:**
```json
{
  "name": "New Workspace",
  "description": "Team workspace"
}
```

### GET /workspaces/:workspaceId
ワークスペース詳細

### PATCH /workspaces/:workspaceId
ワークスペース更新

### GET /workspaces/:workspaceId/members
メンバー一覧

**Query Parameters:**
- `search`: 検索クエリ
- `limit`: 取得件数（デフォルト: 50）
- `offset`: オフセット

### POST /workspaces/:workspaceId/invite
招待リンク生成

---

## 4. チャンネル API

### GET /workspaces/:workspaceId/channels
チャンネル一覧

**Response: 200 OK**
```json
{
  "channels": [
    {
      "id": "uuid",
      "name": "general",
      "description": "General discussion",
      "isPrivate": false,
      "memberCount": 42,
      "unreadCount": 5,
      "lastMessage": { ... }
    }
  ]
}
```

### POST /workspaces/:workspaceId/channels
チャンネル作成

**Request Body:**
```json
{
  "name": "new-channel",
  "description": "Description here",
  "isPrivate": false
}
```

### GET /channels/:channelId
チャンネル詳細

### PATCH /channels/:channelId
チャンネル更新

### DELETE /channels/:channelId
チャンネル削除

### POST /channels/:channelId/join
チャンネル参加

### POST /channels/:channelId/leave
チャンネル退出

### GET /channels/:channelId/members
チャンネルメンバー一覧

---

## 5. メッセージ API

### GET /channels/:channelId/messages
メッセージ一覧取得

**Query Parameters:**
- `limit`: 取得件数（デフォルト: 50、最大: 100）
- `before`: このID以前のメッセージを取得
- `after`: このID以降のメッセージを取得

**Response: 200 OK**
```json
{
  "messages": [
    {
      "id": "uuid",
      "content": "Hello, world!",
      "user": {
        "id": "uuid",
        "displayName": "John",
        "avatarUrl": "..."
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "isEdited": false,
      "reactions": [
        {
          "emoji": "👍",
          "count": 3,
          "users": ["uuid1", "uuid2", "uuid3"]
        }
      ],
      "files": [
        {
          "id": "uuid",
          "filename": "image.png",
          "mimeType": "image/png",
          "size": 12345,
          "url": "https://..."
        }
      ],
      "threadCount": 5,
      "threadLatestReply": "2024-01-01T01:00:00Z"
    }
  ],
  "hasMore": true
}
```

### POST /channels/:channelId/messages
メッセージ送信

**Request Body:**
```json
{
  "content": "Hello, world!",
  "parentId": null
}
```

### PATCH /messages/:messageId
メッセージ編集

**Request Body:**
```json
{
  "content": "Updated message"
}
```

### DELETE /messages/:messageId
メッセージ削除

### GET /messages/:messageId/thread
スレッド取得

---

## 6. リアクション API

### POST /messages/:messageId/reactions
リアクション追加

**Request Body:**
```json
{
  "emoji": "👍"
}
```

### DELETE /messages/:messageId/reactions/:emoji
リアクション削除

---

## 7. ファイル API

### POST /files/upload
ファイルアップロード

**Request:** `multipart/form-data`
- `file`: ファイル
- `channelId`: チャンネルID（オプション）

**Response: 201 Created**
```json
{
  "id": "uuid",
  "filename": "stored_name.png",
  "originalName": "my_image.png",
  "mimeType": "image/png",
  "size": 12345,
  "url": "https://..."
}
```

### GET /files/:fileId
ファイル情報取得

### DELETE /files/:fileId
ファイル削除

---

## 8. ダイレクトメッセージ API

### GET /dms
DM一覧

**Response: 200 OK**
```json
{
  "dms": [
    {
      "id": "uuid",
      "participant": {
        "id": "uuid",
        "displayName": "Jane Doe",
        "avatarUrl": "...",
        "status": "online"
      },
      "lastMessage": { ... },
      "unreadCount": 2
    }
  ]
}
```

### POST /dms
DM作成/取得

**Request Body:**
```json
{
  "userId": "target_user_uuid"
}
```

### GET /dms/:dmId/messages
DMメッセージ一覧

### POST /dms/:dmId/messages
DMメッセージ送信

---

## 9. 検索 API

### GET /search
統合検索

**Query Parameters:**
- `q`: 検索クエリ（必須）
- `type`: 検索対象（messages, files, users, channels）
- `channelId`: チャンネル絞り込み
- `userId`: ユーザー絞り込み
- `from`: 開始日時
- `to`: 終了日時
- `limit`: 取得件数
- `offset`: オフセット

**Response: 200 OK**
```json
{
  "results": {
    "messages": [...],
    "files": [...],
    "users": [...],
    "channels": [...]
  },
  "total": 123
}
```

---

## 10. 通知 API

### GET /notifications
通知一覧

**Query Parameters:**
- `unreadOnly`: 未読のみ（boolean）
- `limit`: 取得件数
- `offset`: オフセット

### PATCH /notifications/:notificationId/read
通知を既読にする

### POST /notifications/read-all
全て既読にする

---

## エラーレスポンス

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### エラーコード

| コード | HTTP Status | 説明 |
|--------|-------------|------|
| UNAUTHORIZED | 401 | 認証エラー |
| FORBIDDEN | 403 | 権限エラー |
| NOT_FOUND | 404 | リソース未発見 |
| VALIDATION_ERROR | 400 | バリデーションエラー |
| CONFLICT | 409 | 競合（重複など） |
| RATE_LIMITED | 429 | レート制限 |
| INTERNAL_ERROR | 500 | サーバーエラー |
