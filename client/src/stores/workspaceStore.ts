import { create } from 'zustand'
import { Workspace, Channel, WorkspaceMember } from '../types'
import { workspaceApi, channelApi } from '../services/api'

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

  loadMembers: (workspaceId: string) => Promise<void>
  searchMembers: (workspaceId: string, search: string) => Promise<WorkspaceMember[]>

  clearError: () => void
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

      // Set first workspace as current if none selected
      if (!get().currentWorkspace && workspaces.length > 0) {
        set({ currentWorkspace: workspaces[0] })
        get().loadChannels(workspaces[0].id)
        get().loadMembers(workspaces[0].id)
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
      get().loadChannels(workspace.id)
      get().loadMembers(workspace.id)
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

      // Set first channel as current if none selected
      if (!get().currentChannel && response.data.channels.length > 0) {
        set({ currentChannel: response.data.channels[0] })
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

  clearError: () => set({ error: null }),
}))
