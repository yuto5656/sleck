import { create } from 'zustand'
import { Message } from '../types'
import { messageApi } from '../services/api'

interface UserInfo {
  id: string
  displayName: string
  avatarUrl: string | null
}

interface ThreadState {
  // The parent message that started the thread
  parentMessage: Message | null
  // Thread replies
  replies: Message[]
  // Loading state
  isLoading: boolean
  // Error state
  error: string | null

  // Open a thread for a message
  openThread: (message: Message) => Promise<void>
  // Close the thread panel
  closeThread: () => void
  // Send a reply in the thread
  sendReply: (channelId: string, content: string, user: UserInfo) => Promise<void>
  // Add a new reply (from socket event)
  addReply: (message: Message) => void
  // Update a reply
  updateReply: (message: Message) => void
  // Remove a reply
  removeReply: (messageId: string) => void
  // Update thread count on parent message
  incrementThreadCount: () => void

  clearError: () => void
}

export const useThreadStore = create<ThreadState>((set, get) => ({
  parentMessage: null,
  replies: [],
  isLoading: false,
  error: null,

  openThread: async (message: Message) => {
    set({ parentMessage: message, replies: [], isLoading: true, error: null })

    try {
      const response = await messageApi.getThread(message.id)
      set({ replies: response.data.replies || [], isLoading: false })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({
        error: err.response?.data?.error?.message || 'Failed to load thread',
        isLoading: false,
      })
    }
  },

  closeThread: () => {
    set({ parentMessage: null, replies: [], isLoading: false, error: null })
  },

  sendReply: async (channelId: string, content: string, user: UserInfo) => {
    const { parentMessage } = get()
    if (!parentMessage) return

    // Optimistic update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const tempReply: Message = {
      id: tempId,
      content,
      parentId: parentMessage.id,
      channelId,
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

    set((state) => ({ replies: [...state.replies, tempReply] }))

    try {
      await messageApi.sendMessage(channelId, { content, parentId: parentMessage.id })
      // Remove temp message - socket event will add the real message
      set((state) => ({
        replies: state.replies.filter((r) => r.id !== tempId),
      }))
    } catch (error: unknown) {
      // Remove temp message on error
      set((state) => ({
        replies: state.replies.filter((r) => r.id !== tempId),
      }))
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to send reply' })
      throw error
    }
  },

  addReply: (message: Message) => {
    const { parentMessage, replies } = get()
    if (!parentMessage || message.parentId !== parentMessage.id) return

    // Check if already exists
    if (replies.some((r) => r.id === message.id)) return

    set((state) => ({ replies: [...state.replies, message] }))
  },

  updateReply: (message: Message) => {
    set((state) => ({
      replies: state.replies.map((r) => (r.id === message.id ? { ...r, ...message } : r)),
    }))
  },

  removeReply: (messageId: string) => {
    set((state) => ({
      replies: state.replies.filter((r) => r.id !== messageId),
    }))
  },

  incrementThreadCount: () => {
    const { parentMessage } = get()
    if (!parentMessage) return

    set({
      parentMessage: {
        ...parentMessage,
        threadCount: parentMessage.threadCount + 1,
      },
    })
  },

  clearError: () => set({ error: null }),
}))
