import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NotificationSettingsState {
  // Global settings
  soundEnabled: boolean

  // Per-channel mute settings (channelId -> muted)
  mutedChannels: Set<string>

  // Actions
  setSoundEnabled: (enabled: boolean) => void
  muteChannel: (channelId: string) => void
  unmuteChannel: (channelId: string) => void
  isChannelMuted: (channelId: string) => boolean
  toggleChannelMute: (channelId: string) => void
}

export const useNotificationSettingsStore = create<NotificationSettingsState>()(
  persist(
    (set, get) => ({
      soundEnabled: true,
      mutedChannels: new Set(),

      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

      muteChannel: (channelId) => {
        const mutedChannels = new Set(get().mutedChannels)
        mutedChannels.add(channelId)
        set({ mutedChannels })
      },

      unmuteChannel: (channelId) => {
        const mutedChannels = new Set(get().mutedChannels)
        mutedChannels.delete(channelId)
        set({ mutedChannels })
      },

      isChannelMuted: (channelId) => {
        return get().mutedChannels.has(channelId)
      },

      toggleChannelMute: (channelId) => {
        if (get().isChannelMuted(channelId)) {
          get().unmuteChannel(channelId)
        } else {
          get().muteChannel(channelId)
        }
      },
    }),
    {
      name: 'sleck-notification-settings',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          // Convert array back to Set
          if (parsed.state?.mutedChannels) {
            parsed.state.mutedChannels = new Set(parsed.state.mutedChannels)
          }
          return parsed
        },
        setItem: (name, value) => {
          // Convert Set to array for storage
          const toStore = {
            ...value,
            state: {
              ...value.state,
              mutedChannels: Array.from(value.state.mutedChannels || []),
            },
          }
          localStorage.setItem(name, JSON.stringify(toStore))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)
