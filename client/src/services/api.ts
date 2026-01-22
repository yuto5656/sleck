import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const response = await axios.post('/api/v1/auth/refresh', { refreshToken })
          const { accessToken, refreshToken: newRefreshToken } = response.data

          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)

          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        } catch {
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          window.location.href = '/login'
        }
      }
    }

    return Promise.reject(error)
  }
)

export default api

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; displayName: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
}

// User API
export const userApi = {
  getMe: () => api.get('/users/me'),
  updateProfile: (data: { displayName?: string; statusMessage?: string }) =>
    api.patch('/users/me', data),
  updateStatus: (status: 'online' | 'away' | 'dnd' | 'offline') =>
    api.patch('/users/me/status', { status }),
  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getUser: (userId: string) => api.get(`/users/${userId}`),
}

// Workspace API
export const workspaceApi = {
  getWorkspaces: () => api.get('/workspaces'),
  createWorkspace: (data: { name: string; description?: string }) =>
    api.post('/workspaces', data),
  getWorkspace: (workspaceId: string) => api.get(`/workspaces/${workspaceId}`),
  updateWorkspace: (workspaceId: string, data: { name?: string; description?: string }) =>
    api.patch(`/workspaces/${workspaceId}`, data),
  getMembers: (workspaceId: string, params?: { search?: string; limit?: number; offset?: number }) =>
    api.get(`/workspaces/${workspaceId}/members`, { params }),
  getChannels: (workspaceId: string) => api.get(`/workspaces/${workspaceId}/channels`),
  createInvite: (workspaceId: string) =>
    api.post(`/workspaces/${workspaceId}/invites`),
  getInviteInfo: (token: string) =>
    api.get(`/workspaces/invites/${token}`),
  acceptInvite: (token: string) =>
    api.post(`/workspaces/invites/${token}/accept`),
}

// Channel API
export const channelApi = {
  createChannel: (workspaceId: string, data: { name: string; description?: string; isPrivate?: boolean }) =>
    api.post(`/workspaces/${workspaceId}/channels`, data),
  getChannel: (channelId: string) => api.get(`/channels/${channelId}`),
  updateChannel: (channelId: string, data: { name?: string; description?: string }) =>
    api.patch(`/channels/${channelId}`, data),
  deleteChannel: (channelId: string) => api.delete(`/channels/${channelId}`),
  joinChannel: (channelId: string) => api.post(`/channels/${channelId}/join`),
  leaveChannel: (channelId: string) => api.post(`/channels/${channelId}/leave`),
  getMembers: (channelId: string) => api.get(`/channels/${channelId}/members`),
  addMember: (channelId: string, userId: string) => api.post(`/channels/${channelId}/members`, { userId }),
}

// Message API
export const messageApi = {
  getMessages: (channelId: string, params?: { limit?: number; before?: string; after?: string }) =>
    api.get(`/channels/${channelId}/messages`, { params }),
  sendMessage: (channelId: string, data: { content: string; parentId?: string }) =>
    api.post(`/channels/${channelId}/messages`, data),
  editMessage: (messageId: string, content: string) =>
    api.patch(`/messages/${messageId}`, { content }),
  deleteMessage: (messageId: string) => api.delete(`/messages/${messageId}`),
  getThread: (messageId: string) => api.get(`/messages/${messageId}/thread`),
  addReaction: (messageId: string, emoji: string) =>
    api.post(`/messages/${messageId}/reactions`, { emoji }),
  removeReaction: (messageId: string, emoji: string) =>
    api.delete(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),
}

// DM API
export const dmApi = {
  getDMs: () => api.get('/dms'),
  createDM: (userId: string) => api.post('/dms', { userId }),
  getMessages: (dmId: string, params?: { limit?: number; before?: string }) =>
    api.get(`/dms/${dmId}/messages`, { params }),
  sendMessage: (dmId: string, content: string) =>
    api.post(`/dms/${dmId}/messages`, { content }),
  editMessage: (dmId: string, messageId: string, content: string) =>
    api.patch(`/dms/${dmId}/messages/${messageId}`, { content }),
  deleteMessage: (dmId: string, messageId: string) =>
    api.delete(`/dms/${dmId}/messages/${messageId}`),
}

// File API
export const fileApi = {
  upload: (file: File, messageId?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (messageId) formData.append('messageId', messageId)
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  uploadMultiple: (files: File[], messageId?: string) => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    if (messageId) formData.append('messageId', messageId)
    return api.post('/files/upload-multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getFile: (fileId: string) => api.get(`/files/${fileId}`),
  deleteFile: (fileId: string) => api.delete(`/files/${fileId}`),
}

// Search API
export const searchApi = {
  search: (params: {
    q: string
    type?: 'messages' | 'files' | 'users' | 'channels'
    channelId?: string
    userId?: string
    from?: string
    to?: string
    limit?: number
    offset?: number
  }) => api.get('/search', { params }),
}

// Notification API
export const notificationApi = {
  getNotifications: (params?: { unreadOnly?: boolean; limit?: number; offset?: number }) =>
    api.get('/notifications', { params }),
  markAsRead: (notificationId: string) =>
    api.patch(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
  deleteNotification: (notificationId: string) =>
    api.delete(`/notifications/${notificationId}`),
  clearAll: () => api.delete('/notifications'),
}
