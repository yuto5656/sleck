import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '../types'
import { authApi, userApi } from '../services/api'
import { socketService } from '../services/socket'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string, inviteToken?: string) => Promise<void>
  logout: () => Promise<void>
  loadUser: () => Promise<void>
  setUser: (user: User) => void
  updateProfile: (data: { displayName?: string; statusMessage?: string }) => Promise<void>
  updateStatus: (status: 'online' | 'away' | 'dnd' | 'offline') => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authApi.login({ email, password })
          const { user, accessToken, refreshToken } = response.data

          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)
          localStorage.setItem('currentUserId', user.id)

          socketService.connect(accessToken)

          set({ user, isAuthenticated: true, isLoading: false })
        } catch (error: unknown) {
          const err = error as { response?: { data?: { error?: { message?: string } } } }
          set({
            error: err.response?.data?.error?.message || 'ログインに失敗しました',
            isLoading: false,
          })
          throw error
        }
      },

      register: async (email: string, password: string, displayName: string, inviteToken?: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authApi.register({ email, password, displayName, ...(inviteToken && { inviteToken }) })
          const { user, accessToken, refreshToken } = response.data

          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)
          localStorage.setItem('currentUserId', user.id)

          socketService.connect(accessToken)

          set({ user, isAuthenticated: true, isLoading: false })
        } catch (error: unknown) {
          const err = error as { response?: { data?: { error?: { message?: string } } } }
          set({
            error: err.response?.data?.error?.message || '登録に失敗しました',
            isLoading: false,
          })
          throw error
        }
      },

      logout: async () => {
        try {
          await authApi.logout()
        } catch {
          // Ignore logout errors
        } finally {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('currentUserId')
          socketService.disconnect()
          set({ user: null, isAuthenticated: false })
        }
      },

      loadUser: async () => {
        const token = localStorage.getItem('accessToken')
        if (!token) {
          set({ isAuthenticated: false, user: null })
          return
        }

        set({ isLoading: true })
        try {
          const response = await userApi.getMe()
          localStorage.setItem('currentUserId', response.data.id)
          socketService.connect(token)
          set({ user: response.data, isAuthenticated: true, isLoading: false })
        } catch {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('currentUserId')
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },

      setUser: (user: User) => {
        set({ user })
      },

      updateProfile: async (data) => {
        try {
          const response = await userApi.updateProfile(data)
          set({ user: { ...get().user!, ...response.data } })
        } catch (error: unknown) {
          const err = error as { response?: { data?: { error?: { message?: string } } } }
          set({ error: err.response?.data?.error?.message || '更新に失敗しました' })
          throw error
        }
      },

      updateStatus: async (status) => {
        try {
          await userApi.updateStatus(status)
          socketService.updatePresence(status === 'offline' ? 'away' : status)
          set({ user: { ...get().user!, status } })
        } catch (error: unknown) {
          const err = error as { response?: { data?: { error?: { message?: string } } } }
          set({ error: err.response?.data?.error?.message || 'ステータスの更新に失敗しました' })
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Listen for own status updates from socket
socketService.onUserStatus((data) => {
  const state = useAuthStore.getState()
  if (state.user?.id === data.userId) {
    const typedStatus = data.status as 'online' | 'away' | 'dnd' | 'offline'
    useAuthStore.setState({ user: { ...state.user, status: typedStatus } })
  }
})
