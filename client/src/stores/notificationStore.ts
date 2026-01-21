import { create } from 'zustand'
import type { Notification as AppNotification } from '../types'
import { notificationApi } from '../services/api'
import { socketService } from '../services/socket'

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  isLoading: boolean
  error: string | null

  loadNotifications: (unreadOnly?: boolean) => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  addNotification: (notification: AppNotification) => void
  clearError: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  loadNotifications: async (unreadOnly = false) => {
    set({ isLoading: true, error: null })
    try {
      const response = await notificationApi.getNotifications({ unreadOnly, limit: 50 })
      const notifications = response.data.notifications || []
      const unreadCount = notifications.filter((n: AppNotification) => !n.isRead).length
      set({ notifications, unreadCount, isLoading: false })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({
        error: err.response?.data?.error?.message || 'Failed to load notifications',
        isLoading: false,
      })
    }
  },

  markAsRead: async (notificationId) => {
    try {
      await notificationApi.markAsRead(notificationId)
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to mark as read' })
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationApi.markAllAsRead()
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }))
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      set({ error: err.response?.data?.error?.message || 'Failed to mark all as read' })
    }
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }))

    // Show browser notification if permitted
    if (Notification.permission === 'granted') {
      const notifTitle = getNotificationTitle(notification.type)
      new Notification(notifTitle, {
        body: notification.content,
        icon: '/favicon.ico',
      })
    }
  },

  clearError: () => set({ error: null }),
}))

function getNotificationTitle(type: string): string {
  switch (type) {
    case 'mention':
      return 'メンションされました'
    case 'dm':
      return '新しいダイレクトメッセージ'
    case 'thread':
      return 'スレッドに返信がありました'
    case 'reaction':
      return 'リアクションが付きました'
    default:
      return '通知'
  }
}

// Set up socket listeners for real-time notifications
socketService.on<AppNotification>('notification:new', (notification) => {
  useNotificationStore.getState().addNotification(notification)
})
