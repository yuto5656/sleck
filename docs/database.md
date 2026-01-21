# Sleck データベース設計書

## 1. ER図

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│      User       │       │    Workspace    │       │     Channel     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──┐   │ id (PK)         │◄──┐   │ id (PK)         │
│ email           │   │   │ name            │   │   │ name            │
│ displayName     │   │   │ description     │   │   │ description     │
│ avatarUrl       │   │   │ iconUrl         │   │   │ isPrivate       │
│ passwordHash    │   │   │ createdAt       │   │   │ workspaceId(FK) │──┘
│ status          │   │   │ updatedAt       │   │   │ createdById(FK) │──┐
│ statusMessage   │   │   └─────────────────┘   │   │ createdAt       │  │
│ createdAt       │   │                         │   │ updatedAt       │  │
│ updatedAt       │   │                         │   └─────────────────┘  │
└─────────────────┘   │                         │            ▲           │
        ▲             │                         │            │           │
        │             │   ┌─────────────────┐   │            │           │
        │             │   │ WorkspaceMember │   │            │           │
        │             └───┤─────────────────┤───┘            │           │
        │                 │ id (PK)         │                │           │
        │                 │ userId (FK)     │────────────────┼───────────┘
        │                 │ workspaceId(FK) │                │
        │                 │ role            │                │
        │                 │ joinedAt        │                │
        │                 └─────────────────┘                │
        │                                                    │
        │             ┌─────────────────┐                    │
        │             │  ChannelMember  │                    │
        │             ├─────────────────┤                    │
        └─────────────┤ id (PK)         │                    │
                      │ userId (FK)     │                    │
                      │ channelId (FK)  │────────────────────┘
                      │ joinedAt        │
                      │ lastReadAt      │
                      └─────────────────┘
                               ▲
                               │
┌─────────────────┐   ┌───────┴─────────┐   ┌─────────────────┐
│    Reaction     │   │     Message     │   │      File       │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ id (PK)         │   │ id (PK)         │   │ id (PK)         │
│ emoji           │   │ content         │◄──┤ messageId (FK)  │
│ userId (FK)     │──►│ channelId (FK)  │   │ filename        │
│ messageId (FK)  │──►│ userId (FK)     │   │ originalName    │
│ createdAt       │   │ parentId (FK)   │──┐│ mimeType        │
└─────────────────┘   │ isEdited        │  ││ size            │
                      │ createdAt       │  ││ url             │
                      │ updatedAt       │  ││ uploadedById(FK)│
                      └─────────────────┘  ││ createdAt       │
                               ▲           │└─────────────────┘
                               └───────────┘
                                 (スレッド)

┌─────────────────┐   ┌─────────────────┐
│ DirectMessage   │   │   Notification  │
├─────────────────┤   ├─────────────────┤
│ id (PK)         │   │ id (PK)         │
│ participant1(FK)│   │ userId (FK)     │
│ participant2(FK)│   │ type            │
│ createdAt       │   │ content         │
│ updatedAt       │   │ referenceId     │
└─────────────────┘   │ isRead          │
        ▲             │ createdAt       │
        │             └─────────────────┘
        │
┌───────┴─────────┐
│   DMMessage     │
├─────────────────┤
│ id (PK)         │
│ dmId (FK)       │
│ senderId (FK)   │
│ content         │
│ isEdited        │
│ createdAt       │
│ updatedAt       │
└─────────────────┘
```

## 2. テーブル定義

### 2.1 User（ユーザー）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| email | VARCHAR(255) | NO | - | メールアドレス（UNIQUE） |
| displayName | VARCHAR(100) | NO | - | 表示名 |
| avatarUrl | TEXT | YES | NULL | アバター画像URL |
| passwordHash | VARCHAR(255) | NO | - | パスワードハッシュ |
| status | ENUM | NO | 'offline' | online/away/dnd/offline |
| statusMessage | VARCHAR(100) | YES | NULL | カスタムステータス |
| createdAt | TIMESTAMP | NO | NOW() | 作成日時 |
| updatedAt | TIMESTAMP | NO | NOW() | 更新日時 |

### 2.2 Workspace（ワークスペース）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| name | VARCHAR(100) | NO | - | ワークスペース名 |
| slug | VARCHAR(50) | NO | - | URLスラッグ（UNIQUE） |
| description | TEXT | YES | NULL | 説明 |
| iconUrl | TEXT | YES | NULL | アイコンURL |
| createdAt | TIMESTAMP | NO | NOW() | 作成日時 |
| updatedAt | TIMESTAMP | NO | NOW() | 更新日時 |

### 2.3 WorkspaceMember（ワークスペースメンバー）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| userId | UUID | NO | - | ユーザーID（FK） |
| workspaceId | UUID | NO | - | ワークスペースID（FK） |
| role | ENUM | NO | 'member' | owner/admin/member |
| joinedAt | TIMESTAMP | NO | NOW() | 参加日時 |

**インデックス**: (userId, workspaceId) UNIQUE

### 2.4 Channel（チャンネル）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| name | VARCHAR(80) | NO | - | チャンネル名 |
| description | TEXT | YES | NULL | 説明 |
| isPrivate | BOOLEAN | NO | false | プライベートフラグ |
| workspaceId | UUID | NO | - | ワークスペースID（FK） |
| createdById | UUID | NO | - | 作成者ID（FK） |
| createdAt | TIMESTAMP | NO | NOW() | 作成日時 |
| updatedAt | TIMESTAMP | NO | NOW() | 更新日時 |

**インデックス**: (workspaceId, name) UNIQUE

### 2.5 ChannelMember（チャンネルメンバー）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| userId | UUID | NO | - | ユーザーID（FK） |
| channelId | UUID | NO | - | チャンネルID（FK） |
| joinedAt | TIMESTAMP | NO | NOW() | 参加日時 |
| lastReadAt | TIMESTAMP | YES | NULL | 最終既読日時 |

**インデックス**: (userId, channelId) UNIQUE

### 2.6 Message（メッセージ）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| content | TEXT | NO | - | メッセージ内容 |
| channelId | UUID | NO | - | チャンネルID（FK） |
| userId | UUID | NO | - | 送信者ID（FK） |
| parentId | UUID | YES | NULL | 親メッセージID（スレッド用） |
| isEdited | BOOLEAN | NO | false | 編集済みフラグ |
| createdAt | TIMESTAMP | NO | NOW() | 作成日時 |
| updatedAt | TIMESTAMP | NO | NOW() | 更新日時 |

**インデックス**:
- (channelId, createdAt)
- (parentId)

### 2.7 Reaction（リアクション）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| emoji | VARCHAR(50) | NO | - | 絵文字コード |
| userId | UUID | NO | - | ユーザーID（FK） |
| messageId | UUID | NO | - | メッセージID（FK） |
| createdAt | TIMESTAMP | NO | NOW() | 作成日時 |

**インデックス**: (userId, messageId, emoji) UNIQUE

### 2.8 File（ファイル）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| messageId | UUID | YES | NULL | メッセージID（FK） |
| filename | VARCHAR(255) | NO | - | 保存ファイル名 |
| originalName | VARCHAR(255) | NO | - | 元ファイル名 |
| mimeType | VARCHAR(100) | NO | - | MIMEタイプ |
| size | BIGINT | NO | - | ファイルサイズ（バイト） |
| url | TEXT | NO | - | ファイルURL |
| uploadedById | UUID | NO | - | アップロード者ID（FK） |
| createdAt | TIMESTAMP | NO | NOW() | 作成日時 |

### 2.9 DirectMessage（ダイレクトメッセージ）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| participant1Id | UUID | NO | - | 参加者1 ID（FK） |
| participant2Id | UUID | NO | - | 参加者2 ID（FK） |
| createdAt | TIMESTAMP | NO | NOW() | 作成日時 |
| updatedAt | TIMESTAMP | NO | NOW() | 更新日時 |

**インデックス**: (participant1Id, participant2Id) UNIQUE

### 2.10 DMMessage（DMメッセージ）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| dmId | UUID | NO | - | DM ID（FK） |
| senderId | UUID | NO | - | 送信者ID（FK） |
| content | TEXT | NO | - | メッセージ内容 |
| isEdited | BOOLEAN | NO | false | 編集済みフラグ |
| createdAt | TIMESTAMP | NO | NOW() | 作成日時 |
| updatedAt | TIMESTAMP | NO | NOW() | 更新日時 |

### 2.11 Notification（通知）

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | UUID | NO | gen_random_uuid() | 主キー |
| userId | UUID | NO | - | 対象ユーザーID（FK） |
| type | ENUM | NO | - | mention/dm/thread/reaction |
| content | TEXT | NO | - | 通知内容 |
| referenceId | UUID | YES | NULL | 参照先ID |
| referenceType | VARCHAR(50) | YES | NULL | 参照先タイプ |
| isRead | BOOLEAN | NO | false | 既読フラグ |
| createdAt | TIMESTAMP | NO | NOW() | 作成日時 |

**インデックス**: (userId, isRead, createdAt)

## 3. インデックス戦略

### パフォーマンス重視インデックス

```sql
-- メッセージ取得の高速化
CREATE INDEX idx_messages_channel_created ON messages(channel_id, created_at DESC);

-- スレッド取得の高速化
CREATE INDEX idx_messages_parent ON messages(parent_id) WHERE parent_id IS NOT NULL;

-- 未読通知の取得
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE is_read = false;

-- メッセージ検索（全文検索）
CREATE INDEX idx_messages_content_search ON messages USING GIN (to_tsvector('english', content));
```
