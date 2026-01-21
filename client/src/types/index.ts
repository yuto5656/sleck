export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  status: 'online' | 'away' | 'dnd' | 'offline'
  statusMessage: string | null
  createdAt: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  iconUrl: string | null
  role: 'owner' | 'admin' | 'member'
  createdAt: string
}

export interface Channel {
  id: string
  name: string
  description: string | null
  isPrivate: boolean
  memberCount: number
  unreadCount?: number
  lastReadAt?: string
  createdAt: string
}

export interface Message {
  id: string
  content: string
  channelId?: string
  user: {
    id: string
    displayName: string
    avatarUrl: string | null
  }
  createdAt: string
  updatedAt: string
  isEdited: boolean
  reactions: Reaction[]
  files: FileAttachment[]
  threadCount: number
  threadLatestReply?: string | null
  parentId?: string | null
}

export interface Reaction {
  emoji: string
  count: number
  users: string[]
}

export interface FileAttachment {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  url: string
}

export interface DirectMessage {
  id: string
  participant: {
    id: string
    displayName: string
    avatarUrl: string | null
    status: 'online' | 'away' | 'dnd' | 'offline'
  }
  lastMessage: {
    content: string
    createdAt: string
    senderId: string
  } | null
  unreadCount?: number
  updatedAt: string
}

export interface DMMessage {
  id: string
  dmId: string
  content: string
  sender: {
    id: string
    displayName: string
    avatarUrl: string | null
  }
  isEdited: boolean
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  type: 'mention' | 'dm' | 'thread' | 'reaction'
  content: string
  referenceId: string | null
  referenceType: string | null
  isRead: boolean
  createdAt: string
}

export interface WorkspaceMember {
  id: string
  displayName: string
  avatarUrl: string | null
  status: 'online' | 'away' | 'dnd' | 'offline'
  statusMessage?: string | null
  role: 'owner' | 'admin' | 'member'
  joinedAt: string
}
