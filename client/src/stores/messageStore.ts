import { create } from 'zustand'
import { Message } from '../types'
import { messageApi } from '../services/api'
import { socketService } from '../services/socket'

interface UserInfo {
  id: string
  displayName: string
  avatarUrl: string | null
  status: string
}

interface MessageState {
  messages: Map<string, Message[]> // channelId -> messages
  isLoading: boolean
  hasMore: Map<string, boolean>
  error: string | null
  pendingMessageIds: Set<string> // Track temp message IDs

  loadMessages: (channelId: string, before?: string) => Promise<void>
  sendMessage: (channelId: string, content: string, user: UserInfo, parentId?: string) => Promise<void>
  editMessage: (messageId: string, content: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  addReaction: (messageId: string, emoji: string) => Promise<void>
  removeReaction: (messageId: string, emoji: string) => Promise<void>

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

  loadMessages: async (channelId, before) => {
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
      channelId,
      parentId: parentId || null,
      user: {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status,
      },
      files: [],
      reactions: [],
      threadCount: 0,
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Add temp message immediately and track the pending ID
    const messages = new Map(get().messages)
    const channelMessages = messages.get(channelId) || []
    messages.set(channelId, [...channelMessages, tempMessage])
    const pendingMessageIds = new Set(get().pendingMessageIds)
    pendingMessageIds.add(tempId)
    set({ messages, pendingMessageIds })

    try {
      await messageApi.sendMessage(channelId, { content, parentId })
      // Remove temp message - socket event will add the real message
      const updatedMessages = new Map(get().messages)
      const currentMessages = updatedMessages.get(channelId) || []
      updatedMessages.set(channelId, currentMessages.filter(m => m.id !== tempId))
      const updatedPendingIds = new Set(get().pendingMessageIds)
      updatedPendingIds.delete(tempId)
      set({ messages: updatedMessages, pendingMessageIds: updatedPendingIds })
    } catch (error: unknown) {
      // Remove temp message on error
      const updatedMessages = new Map(get().messages)
      const currentMessages = updatedMessages.get(channelId) || []
      updatedMessages.set(channelId, currentMessages.filter(m => m.id !== tempId))
      const updatedPendingIds = new Set(get().pendingMessageIds)
      updatedPendingIds.delete(tempId)
      set({ messages: updatedMessages, pendingMessageIds: updatedPendingIds })

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

  addReaction: async (messageId, emoji) => {
    try {
      await messageApi.addReaction(messageId, emoji)
      // Reaction will be updated via socket event
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to add reaction' })
    }
  },

  removeReaction: async (messageId, emoji) => {
    try {
      await messageApi.removeReaction(messageId, emoji)
      // Reaction will be updated via socket event
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to remove reaction' })
    }
  },

  addMessage: (channelId, message) => {
    const messages = new Map(get().messages)
    const channelMessages = messages.get(channelId) || []

    // Check if message already exists
    if (channelMessages.some((m) => m.id === message.id)) {
      return
    }

    messages.set(channelId, [...channelMessages, message])
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

socketService.onReactionAdd((data) => {
  useMessageStore.getState().updateReaction(data.messageId, data.emoji, data.userId, 'add')
})

socketService.onReactionRemove((data) => {
  useMessageStore.getState().updateReaction(data.messageId, data.emoji, data.userId, 'remove')
})
