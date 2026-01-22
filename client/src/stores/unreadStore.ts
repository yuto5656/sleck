import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UnreadState {
  // Set of channel IDs that have unread messages
  unreadChannels: Set<string>
  // Set of DM IDs that have unread messages
  unreadDMs: Set<string>

  // Mark a channel as having unread messages
  markChannelUnread: (channelId: string) => void
  // Mark a channel as read
  markChannelRead: (channelId: string) => void
  // Mark a DM as having unread messages
  markDMUnread: (dmId: string) => void
  // Mark a DM as read
  markDMRead: (dmId: string) => void
  // Check if a channel has unread messages
  hasUnreadChannel: (channelId: string) => boolean
  // Check if a DM has unread messages
  hasUnreadDM: (dmId: string) => boolean
  // Clear all unread state
  clearAll: () => void
}

export const useUnreadStore = create<UnreadState>()(
  persist(
    (set, get) => ({
      unreadChannels: new Set<string>(),
      unreadDMs: new Set<string>(),

      markChannelUnread: (channelId: string) => {
        set((state) => {
          const newUnread = new Set(state.unreadChannels)
          newUnread.add(channelId)
          return { unreadChannels: newUnread }
        })
      },

      markChannelRead: (channelId: string) => {
        set((state) => {
          const newUnread = new Set(state.unreadChannels)
          newUnread.delete(channelId)
          return { unreadChannels: newUnread }
        })
      },

      markDMUnread: (dmId: string) => {
        set((state) => {
          const newUnread = new Set(state.unreadDMs)
          newUnread.add(dmId)
          return { unreadDMs: newUnread }
        })
      },

      markDMRead: (dmId: string) => {
        set((state) => {
          const newUnread = new Set(state.unreadDMs)
          newUnread.delete(dmId)
          return { unreadDMs: newUnread }
        })
      },

      hasUnreadChannel: (channelId: string) => {
        return get().unreadChannels.has(channelId)
      },

      hasUnreadDM: (dmId: string) => {
        return get().unreadDMs.has(dmId)
      },

      clearAll: () => {
        set({ unreadChannels: new Set(), unreadDMs: new Set() })
      },
    }),
    {
      name: 'unread-storage',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const data = JSON.parse(str)
          return {
            state: {
              ...data.state,
              unreadChannels: new Set(data.state.unreadChannels || []),
              unreadDMs: new Set(data.state.unreadDMs || []),
            },
          }
        },
        setItem: (name, value) => {
          const data = {
            state: {
              ...value.state,
              unreadChannels: Array.from(value.state.unreadChannels || []),
              unreadDMs: Array.from(value.state.unreadDMs || []),
            },
          }
          localStorage.setItem(name, JSON.stringify(data))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)
