import { create } from 'zustand'
import { Workspace, Channel, WorkspaceMember } from '../types'
import { workspaceApi, channelApi, messageApi } from '../services/api'
import { socketService } from '../services/socket'

const LAST_WORKSPACE_KEY = 'sleck_last_workspace_id'

interface WorkspaceState {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  channels: Channel[]
  currentChannel: Channel | null
  members: WorkspaceMember[]
  isLoading: boolean
  error: string | null

  loadWorkspaces: () => Promise<void>
  setCurrentWorkspace: (workspace: Workspace | null) => void
  createWorkspace: (name: string, description?: string) => Promise<Workspace>

  loadChannels: (workspaceId: string) => Promise<void>
  setCurrentChannel: (channel: Channel | null) => void
  createChannel: (workspaceId: string, name: string, description?: string, isPrivate?: boolean) => Promise<Channel>
  deleteChannel: (channelId: string) => Promise<void>
  joinChannel: (channelId: string) => Promise<void>
  leaveChannel: (channelId: string) => Promise<void>
  addChannel: (channel: Channel) => void
  removeChannel: (channelId: string) => void

  loadMembers: (workspaceId: string) => Promise<void>
  searchMembers: (workspaceId: string, search: string) => Promise<WorkspaceMember[]>

  clearError: () => void
  initSocketListeners: () => () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  channels: [],
  currentChannel: null,
  members: [],
  isLoading: false,
  error: null,

  loadWorkspaces: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await workspaceApi.getWorkspaces()
      const workspaces = response.data.workspaces

      set({ workspaces, isLoading: false })

      // Set workspace as current if none selected
      if (!get().currentWorkspace && workspaces.length > 0) {
        // Try to restore last selected workspace from localStorage
        const lastWorkspaceId = localStorage.getItem(LAST_WORKSPACE_KEY)
        const targetWorkspace = lastWorkspaceId
          ? workspaces.find(w => w.id === lastWorkspaceId) || workspaces[0]
          : workspaces[0]

        set({ currentWorkspace: targetWorkspace })
        // Load channels and members in parallel for faster startup
        Promise.all([
          get().loadChannels(targetWorkspace.id),
          get().loadMembers(targetWorkspace.id),
        ])
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({
        error: err.response?.data?.error?.message || 'Failed to load workspaces',
        isLoading: false,
      })
    }
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace, currentChannel: null, channels: [], members: [] })
    if (workspace) {
      // Save to localStorage for persistence across reloads
      localStorage.setItem(LAST_WORKSPACE_KEY, workspace.id)
      // Load channels and members in parallel
      Promise.all([
        get().loadChannels(workspace.id),
        get().loadMembers(workspace.id),
      ])
    } else {
      localStorage.removeItem(LAST_WORKSPACE_KEY)
    }
  },

  createWorkspace: async (name, description) => {
    try {
      const response = await workspaceApi.createWorkspace({ name, description })
      const workspace = response.data

      set((state) => ({
        workspaces: [...state.workspaces, { ...workspace, role: 'owner' }],
      }))

      return workspace
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to create workspace' })
      throw error
    }
  },

  loadChannels: async (workspaceId) => {
    try {
      const response = await workspaceApi.getChannels(workspaceId)
      set({ channels: response.data.channels })

      // Set first channel as current if none selected and preload its messages
      if (!get().currentChannel && response.data.channels.length > 0) {
        const firstChannel = response.data.channels[0]
        set({ currentChannel: firstChannel })

        // Preload messages for the first channel for faster initial display
        try {
          const messagesResponse = await messageApi.getMessages(firstChannel.id, { limit: 50 })
          // Import messageStore lazily to avoid circular dependencies
          const { useMessageStore } = await import('./messageStore')
          const messageState = useMessageStore.getState()
          const messages = new Map(messageState.messages)
          messages.set(firstChannel.id, messagesResponse.data.messages)
          const hasMore = new Map(messageState.hasMore)
          hasMore.set(firstChannel.id, messagesResponse.data.hasMore)
          useMessageStore.setState({ messages, hasMore })
          socketService.joinChannel(firstChannel.id)
        } catch {
          // Ignore preload errors - messages will load when navigating
        }
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to load channels' })
    }
  },

  setCurrentChannel: (channel) => {
    set({ currentChannel: channel })
  },

  createChannel: async (workspaceId, name, description, isPrivate = false) => {
    try {
      const response = await channelApi.createChannel(workspaceId, {
        name,
        description,
        isPrivate,
      })
      const channel = response.data

      set((state) => ({
        channels: [...state.channels, channel],
      }))

      return channel
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to create channel' })
      throw error
    }
  },

  deleteChannel: async (channelId) => {
    try {
      await channelApi.deleteChannel(channelId)
      set((state) => ({
        channels: state.channels.filter((c) => c.id !== channelId),
        currentChannel: state.currentChannel?.id === channelId ? null : state.currentChannel,
      }))
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'チャンネルの削除に失敗しました' })
      throw error
    }
  },

  joinChannel: async (channelId) => {
    try {
      await channelApi.joinChannel(channelId)
      // Reload channels to get updated list
      const workspace = get().currentWorkspace
      if (workspace) {
        get().loadChannels(workspace.id)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to join channel' })
      throw error
    }
  },

  leaveChannel: async (channelId) => {
    try {
      await channelApi.leaveChannel(channelId)
      set((state) => ({
        channels: state.channels.filter((c) => c.id !== channelId),
        currentChannel: state.currentChannel?.id === channelId ? null : state.currentChannel,
      }))
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to leave channel' })
      throw error
    }
  },

  loadMembers: async (workspaceId) => {
    try {
      const response = await workspaceApi.getMembers(workspaceId)
      set({ members: response.data.members })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to load members' })
    }
  },

  searchMembers: async (workspaceId, search) => {
    try {
      const response = await workspaceApi.getMembers(workspaceId, { search })
      return response.data.members
    } catch {
      return []
    }
  },

  addChannel: (channel) => {
    set((state) => {
      // Check if channel already exists
      if (state.channels.some(c => c.id === channel.id)) {
        return state
      }
      return { channels: [...state.channels, channel] }
    })
  },

  removeChannel: (channelId) => {
    set((state) => ({
      channels: state.channels.filter((c) => c.id !== channelId),
      currentChannel: state.currentChannel?.id === channelId ? null : state.currentChannel,
    }))
  },

  clearError: () => set({ error: null }),

  initSocketListeners: () => {
    const cleanupCreated = socketService.onChannelCreated((channel) => {
      get().addChannel({
        ...channel,
        lastReadAt: undefined,
      })
    })

    const cleanupDeleted = socketService.onChannelDeleted(({ channelId }) => {
      get().removeChannel(channelId)
    })

    return () => {
      cleanupCreated()
      cleanupDeleted()
    }
  },
}))
