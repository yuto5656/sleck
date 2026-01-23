import { create } from 'zustand'
import { DirectMessage, DMMessage } from '../types'
import { dmApi } from '../services/api'
import { socketService } from '../services/socket'
import { messageCache } from '../services/messageCache'

interface DMState {
  dms: DirectMessage[]
  currentDM: DirectMessage | null
  messages: Map<string, DMMessage[]> // dmId -> messages
  isLoading: boolean
  hasMore: Map<string, boolean>
  error: string | null

  loadDMs: () => Promise<void>
  setCurrentDM: (dm: DirectMessage | null) => void
  createDM: (userId: string) => Promise<DirectMessage>

  loadMessages: (dmId: string, before?: string) => Promise<void>
  sendMessage: (dmId: string, content: string) => Promise<void>
  editMessage: (dmId: string, messageId: string, content: string) => Promise<void>
  deleteMessage: (dmId: string, messageId: string) => Promise<void>

  // Real-time updates
  addMessage: (dmId: string, message: DMMessage) => void
  updateMessage: (message: DMMessage) => void
  removeMessage: (messageId: string, dmId: string) => void
  updateUserStatus: (userId: string, status: string) => void

  clearError: () => void
}

export const useDMStore = create<DMState>((set, get) => ({
  dms: [],
  currentDM: null,
  messages: new Map(),
  isLoading: false,
  hasMore: new Map(),
  error: null,

  loadDMs: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await dmApi.getDMs()
      set({ dms: response.data.dms, isLoading: false })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({
        error: err.response?.data?.error?.message || 'Failed to load DMs',
        isLoading: false,
      })
    }
  },

  setCurrentDM: (dm) => {
    set({ currentDM: dm })
  },

  createDM: async (userId) => {
    try {
      const response = await dmApi.createDM(userId)
      const dm = response.data

      // Check if DM already exists in list
      const exists = get().dms.some((d) => d.id === dm.id)
      if (!exists) {
        set((state) => ({
          dms: [{ ...dm, lastMessage: null, updatedAt: new Date().toISOString() }, ...state.dms],
        }))
      }

      return dm
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to create DM' })
      throw error
    }
  },

  loadMessages: async (dmId, before) => {
    // If loading initial messages (no before cursor), try cache first
    if (!before) {
      const cached = await messageCache.getDMMessages(dmId)
      if (cached) {
        // Show cached messages immediately
        const messages = new Map(get().messages)
        messages.set(dmId, cached.messages)
        const hasMore = new Map(get().hasMore)
        hasMore.set(dmId, cached.hasMore)
        set({ messages, hasMore })
      }
    }

    set({ isLoading: true, error: null })
    try {
      const response = await dmApi.getMessages(dmId, { limit: 50, before })

      const newMessages = response.data.messages
      const existingMessages = before ? get().messages.get(dmId) || [] : []

      const messages = new Map(get().messages)
      messages.set(dmId, before ? [...newMessages, ...existingMessages] : newMessages)

      const hasMore = new Map(get().hasMore)
      hasMore.set(dmId, response.data.hasMore)

      set({ messages, hasMore, isLoading: false })

      // Cache initial messages for faster re-login
      if (!before) {
        messageCache.setDMMessages(dmId, newMessages, response.data.hasMore)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({
        error: err.response?.data?.error?.message || 'Failed to load messages',
        isLoading: false,
      })
    }
  },

  sendMessage: async (dmId, content) => {
    try {
      await dmApi.sendMessage(dmId, content)
      // Message will be added via socket event
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to send message' })
      throw error
    }
  },

  editMessage: async (dmId, messageId, content) => {
    try {
      await dmApi.editMessage(dmId, messageId, content)
      // Message will be updated via socket event
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to edit message' })
      throw error
    }
  },

  deleteMessage: async (dmId, messageId) => {
    try {
      await dmApi.deleteMessage(dmId, messageId)
      // Message will be removed via socket event
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to delete message' })
      throw error
    }
  },

  addMessage: (dmId, message) => {
    const messages = new Map(get().messages)
    const dmMessages = messages.get(dmId) || []

    // Check if message already exists
    if (dmMessages.some((m) => m.id === message.id)) {
      return
    }

    messages.set(dmId, [...dmMessages, message])
    set({ messages })

    // Update DM list with last message
    set((state) => ({
      dms: state.dms.map((dm) =>
        dm.id === dmId
          ? {
              ...dm,
              lastMessage: {
                content: message.content,
                createdAt: message.createdAt,
                senderId: message.sender.id,
              },
              updatedAt: message.createdAt,
            }
          : dm
      ),
    }))
  },

  updateMessage: (message) => {
    const messages = new Map(get().messages)
    const dmMessages = messages.get(message.dmId)

    if (dmMessages) {
      const index = dmMessages.findIndex((m) => m.id === message.id)
      if (index !== -1) {
        const newMessages = [...dmMessages]
        newMessages[index] = message
        messages.set(message.dmId, newMessages)
        set({ messages })
      }
    }
  },

  removeMessage: (messageId, dmId) => {
    const messages = new Map(get().messages)
    const dmMessages = messages.get(dmId)

    if (dmMessages) {
      messages.set(
        dmId,
        dmMessages.filter((m) => m.id !== messageId)
      )
      set({ messages })
    }
  },

  updateUserStatus: (userId, status) => {
    set((state) => ({
      dms: state.dms.map((dm) =>
        dm.participant.id === userId
          ? {
              ...dm,
              participant: {
                ...dm.participant,
                status,
              },
            }
          : dm
      ),
      currentDM:
        state.currentDM?.participant.id === userId
          ? {
              ...state.currentDM,
              participant: {
                ...state.currentDM.participant,
                status,
              },
            }
          : state.currentDM,
    }))
  },

  clearError: () => set({ error: null }),
}))

// Set up socket listeners
socketService.onNewDM((message) => {
  useDMStore.getState().addMessage(message.dmId, message)
})

socketService.onDMUpdate((message) => {
  useDMStore.getState().updateMessage(message)
})

socketService.onDMDelete((data) => {
  useDMStore.getState().removeMessage(data.id, data.dmId)
})

// Listen for user status changes
socketService.onUserStatus((data) => {
  useDMStore.getState().updateUserStatus(data.userId, data.status)
})

socketService.onUserOnline((data) => {
  useDMStore.getState().updateUserStatus(data.userId, 'online')
})

socketService.onUserOffline((data) => {
  useDMStore.getState().updateUserStatus(data.userId, 'offline')
})
