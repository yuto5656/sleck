import { create } from 'zustand'
import { Message } from '../types'
import { messageApi } from '../services/api'
import { socketService } from '../services/socket'
import { messageCache } from '../services/messageCache'

interface UserInfo {
  id: string
  displayName: string
  avatarUrl: string | null
}

interface MessageState {
  messages: Map<string, Message[]> // channelId -> messages
  isLoading: boolean
  hasMore: Map<string, boolean>
  error: string | null
  pendingMessageIds: Set<string> // Track temp message IDs
  pendingReactions: Set<string> // Track pending reaction requests (messageId:emoji)

  loadMessages: (channelId: string, before?: string) => Promise<void>
  sendMessage: (channelId: string, content: string, user: UserInfo, parentId?: string) => Promise<void>
  editMessage: (messageId: string, content: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  addReaction: (messageId: string, emoji: string, userId: string) => Promise<void>
  removeReaction: (messageId: string, emoji: string, userId: string) => Promise<void>
  isReactionPending: (messageId: string, emoji: string) => boolean

  // Real-time updates
  addMessage: (channelId: string, message: Message) => void
  updateMessage: (message: Message) => void
  removeMessage: (messageId: string) => void
  updateReaction: (messageId: string, emoji: string, userId: string, action: 'add' | 'remove') => void

  clearError: () => void
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: new Map(),
  isLoading: false,
  hasMore: new Map(),
  error: null,
  pendingMessageIds: new Set(),
  pendingReactions: new Set(),

  loadMessages: async (channelId, before) => {
    // If loading initial messages (no before cursor), try cache first
    if (!before) {
      const cached = await messageCache.getChannelMessages(channelId)
      if (cached) {
        // Show cached messages immediately
        const messages = new Map(get().messages)
        messages.set(channelId, cached.messages)
        const hasMore = new Map(get().hasMore)
        hasMore.set(channelId, cached.hasMore)
        set({ messages, hasMore })
        // Join socket room immediately
        socketService.joinChannel(channelId)
      }
    }

    set({ isLoading: true, error: null })
    try {
      const response = await messageApi.getMessages(channelId, {
        limit: 50,
        before,
      })

      const newMessages = response.data.messages
      const existingMessages = before ? get().messages.get(channelId) || [] : []

      const messages = new Map(get().messages)
      messages.set(channelId, before ? [...newMessages, ...existingMessages] : newMessages)

      const hasMore = new Map(get().hasMore)
      hasMore.set(channelId, response.data.hasMore)

      set({ messages, hasMore, isLoading: false })

      // Cache initial messages for faster re-login
      if (!before) {
        messageCache.setChannelMessages(channelId, newMessages, response.data.hasMore)
      }

      // Join socket room
      socketService.joinChannel(channelId)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({
        error: err.response?.data?.error?.message || 'Failed to load messages',
        isLoading: false,
      })
    }
  },

  sendMessage: async (channelId, content, user, parentId) => {
    // Optimistic update - add message immediately with temp ID
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const tempMessage: Message = {
      id: tempId,
      content,
      parentId: parentId || null,
      user: {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      files: [],
      reactions: [],
      threadCount: 0,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Add temp message immediately and track the pending ID
    // Only add to main message list if it's not a thread reply
    const pendingMessageIds = new Set(get().pendingMessageIds)
    pendingMessageIds.add(tempId)

    if (!parentId) {
      const messages = new Map(get().messages)
      const channelMessages = messages.get(channelId) || []
      messages.set(channelId, [...channelMessages, tempMessage])
      set({ messages, pendingMessageIds })
    } else {
      set({ pendingMessageIds })
    }

    try {
      await messageApi.sendMessage(channelId, { content, parentId })
      // Don't remove temp message here - let addMessage handle the replacement
      // This prevents flickering between temp removal and socket event arrival
      const updatedPendingIds = new Set(get().pendingMessageIds)
      updatedPendingIds.delete(tempId)
      set({ pendingMessageIds: updatedPendingIds })
    } catch (error: unknown) {
      // Remove temp message on error
      if (!parentId) {
        const updatedMessages = new Map(get().messages)
        const currentMessages = updatedMessages.get(channelId) || []
        updatedMessages.set(channelId, currentMessages.filter(m => m.id !== tempId))
        set({ messages: updatedMessages })
      }
      const updatedPendingIds = new Set(get().pendingMessageIds)
      updatedPendingIds.delete(tempId)
      set({ pendingMessageIds: updatedPendingIds })

      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to send message' })
      throw error
    }
  },

  editMessage: async (messageId, content) => {
    try {
      await messageApi.editMessage(messageId, content)
      // Message will be updated via socket event
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to edit message' })
      throw error
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await messageApi.deleteMessage(messageId)
      // Message will be removed via socket event
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to delete message' })
      throw error
    }
  },

  addReaction: async (messageId, emoji, userId) => {
    const reactionKey = `${messageId}:${emoji}`

    // Prevent duplicate requests (spam protection)
    if (get().pendingReactions.has(reactionKey)) {
      return
    }

    // Mark as pending
    const pendingReactions = new Set(get().pendingReactions)
    pendingReactions.add(reactionKey)
    set({ pendingReactions })

    // Optimistic update - update UI immediately
    get().updateReaction(messageId, emoji, userId, 'add')

    try {
      await messageApi.addReaction(messageId, emoji)
      // Server will send socket event, but we've already updated
    } catch (error: unknown) {
      // Rollback on error
      get().updateReaction(messageId, emoji, userId, 'remove')
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to add reaction' })
    } finally {
      // Remove from pending
      const updated = new Set(get().pendingReactions)
      updated.delete(reactionKey)
      set({ pendingReactions: updated })
    }
  },

  removeReaction: async (messageId, emoji, userId) => {
    const reactionKey = `${messageId}:${emoji}`

    // Prevent duplicate requests (spam protection)
    if (get().pendingReactions.has(reactionKey)) {
      return
    }

    // Mark as pending
    const pendingReactions = new Set(get().pendingReactions)
    pendingReactions.add(reactionKey)
    set({ pendingReactions })

    // Optimistic update - update UI immediately
    get().updateReaction(messageId, emoji, userId, 'remove')

    try {
      await messageApi.removeReaction(messageId, emoji)
      // Server will send socket event, but we've already updated
    } catch (error: unknown) {
      // Rollback on error
      get().updateReaction(messageId, emoji, userId, 'add')
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to remove reaction' })
    } finally {
      // Remove from pending
      const updated = new Set(get().pendingReactions)
      updated.delete(reactionKey)
      set({ pendingReactions: updated })
    }
  },

  isReactionPending: (messageId, emoji) => {
    return get().pendingReactions.has(`${messageId}:${emoji}`)
  },

  addMessage: (channelId, message) => {
    const state = get()
    const messages = new Map(state.messages)
    const channelMessages = messages.get(channelId) || []

    // Check if message already exists by ID
    if (channelMessages.some((m) => m.id === message.id)) {
      return
    }

    // Find temp message with same content from same user (optimistic update replacement)
    const tempIndex = channelMessages.findIndex(
      (m) =>
        m.id.startsWith('temp-') &&
        m.content === message.content &&
        m.user.id === message.user.id
    )

    if (tempIndex !== -1) {
      // Replace temp message in place (preserves position, no flicker)
      const newMessages = [...channelMessages]
      newMessages[tempIndex] = message
      messages.set(channelId, newMessages)
    } else {
      // No temp message found, append as new
      messages.set(channelId, [...channelMessages, message])
    }

    set({ messages })
  },

  updateMessage: (message) => {
    const messages = new Map(get().messages)

    for (const [channelId, channelMessages] of messages) {
      const index = channelMessages.findIndex((m) => m.id === message.id)
      if (index !== -1) {
        const newMessages = [...channelMessages]
        newMessages[index] = { ...newMessages[index], ...message }
        messages.set(channelId, newMessages)
        set({ messages })
        return
      }
    }
  },

  removeMessage: (messageId) => {
    const messages = new Map(get().messages)

    for (const [channelId, channelMessages] of messages) {
      const filtered = channelMessages.filter((m) => m.id !== messageId)
      if (filtered.length !== channelMessages.length) {
        messages.set(channelId, filtered)
        set({ messages })
        return
      }
    }
  },

  updateReaction: (messageId, emoji, userId, action) => {
    const messages = new Map(get().messages)

    for (const [channelId, channelMessages] of messages) {
      const index = channelMessages.findIndex((m) => m.id === messageId)
      if (index !== -1) {
        const newMessages = [...channelMessages]
        const message = { ...newMessages[index] }
        const reactions = [...message.reactions]

        const reactionIndex = reactions.findIndex((r) => r.emoji === emoji)

        if (action === 'add') {
          if (reactionIndex !== -1) {
            reactions[reactionIndex] = {
              ...reactions[reactionIndex],
              count: reactions[reactionIndex].count + 1,
              users: [...reactions[reactionIndex].users, userId],
            }
          } else {
            reactions.push({ emoji, count: 1, users: [userId] })
          }
        } else {
          if (reactionIndex !== -1) {
            const reaction = reactions[reactionIndex]
            if (reaction.count <= 1) {
              reactions.splice(reactionIndex, 1)
            } else {
              reactions[reactionIndex] = {
                ...reaction,
                count: reaction.count - 1,
                users: reaction.users.filter((u) => u !== userId),
              }
            }
          }
        }

        message.reactions = reactions
        newMessages[index] = message
        messages.set(channelId, newMessages)
        set({ messages })
        return
      }
    }
  },

  clearError: () => set({ error: null }),
}))

// Set up socket listeners for global events (edit, delete, reactions)
// Note: New messages are handled in ChannelPage.tsx with the correct channelId

socketService.onMessageUpdate((message) => {
  useMessageStore.getState().updateMessage(message)
})

socketService.onMessageDelete((data) => {
  useMessageStore.getState().removeMessage(data.id)
})

// Socket listeners for reactions from OTHER users only
// Our own reactions are handled optimistically, so we skip them here to avoid double-updating
socketService.onReactionAdd((data) => {
  const currentUserId = localStorage.getItem('currentUserId')
  if (data.userId !== currentUserId) {
    useMessageStore.getState().updateReaction(data.messageId, data.emoji, data.userId, 'add')
  }
})

socketService.onReactionRemove((data) => {
  const currentUserId = localStorage.getItem('currentUserId')
  if (data.userId !== currentUserId) {
    useMessageStore.getState().updateReaction(data.messageId, data.emoji, data.userId, 'remove')
  }
})
