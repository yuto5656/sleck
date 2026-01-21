import { useEffect, useRef, useState } from 'react'
import { X, Check, Trash2, Bell } from 'lucide-react'
import { format } from 'date-fns'
import { notificationApi } from '../services/api'
import { Notification } from '../types'

interface NotificationPanelProps {
  onClose: () => void
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadNotifications()

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const loadNotifications = async () => {
    try {
      const response = await notificationApi.getNotifications({ limit: 50 })
      setNotifications(response.data.notifications)
      setUnreadCount(response.data.unreadCount)
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await notificationApi.deleteNotification(id)
      const notification = notifications.find((n) => n.id === id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      if (notification && !notification.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Failed to delete notification:', error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'mention':
        return '@'
      case 'dm':
        return '💬'
      case 'thread':
        return '🧵'
      case 'reaction':
        return '👍'
      default:
        return '📣'
    }
  }

  return (
    <div
      ref={panelRef}
      className="fixed top-12 right-4 w-96 bg-white rounded-lg shadow-xl border z-50 max-h-[70vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          <h2 className="font-bold">通知</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="text-sm text-blue-600 hover:underline"
            >
              すべて既読にする
            </button>
          )}
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">読み込み中...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>通知はありません</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 ${
                  !notification.isRead ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-sm">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{notification.content}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(notification.createdAt), 'MMM d, HH:mm')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!notification.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                        title="既読にする"
                      >
                        <Check className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(notification.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
