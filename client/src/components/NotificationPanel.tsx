import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Check, Trash2, Bell } from 'lucide-react'
import { format } from 'date-fns'
import { useNotificationStore } from '../stores/notificationStore'
import { notificationApi } from '../services/api'
import { Notification } from '../types'
import { useToast } from './Toast'
import { getErrorMessage } from '../utils/errorUtils'

interface NotificationPanelProps {
  onClose: () => void
  triggerSelector?: string
}

export default function NotificationPanel({ onClose, triggerSelector }: NotificationPanelProps) {
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const toast = useToast()
  const { notifications, unreadCount, isLoading, loadNotifications, markAsRead, markAllAsRead } = useNotificationStore()

  useEffect(() => {
    loadNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      // Don't close if clicking the trigger button (toggle will handle it)
      if (triggerSelector) {
        const trigger = document.querySelector(triggerSelector)
        if (trigger?.contains(target)) {
          return
        }
      }
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, triggerSelector])

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id)
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
  }

  const handleDelete = async (id: string) => {
    try {
      await notificationApi.deleteNotification(id)
      // Reload to update the list
      loadNotifications()
    } catch (error) {
      toast.error(getErrorMessage(error, '通知の削除に失敗しました'))
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }

    // Navigate based on notification type
    if (notification.referenceType === 'channel' && notification.referenceId) {
      navigate(`/channel/${notification.referenceId}`)
      onClose()
    } else if (notification.referenceType === 'dm' && notification.referenceId) {
      navigate(`/dm/${notification.referenceId}`)
      onClose()
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
      className="fixed top-12 right-4 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-50 max-h-[70vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="font-bold text-gray-900 dark:text-white">通知</h2>
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
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              すべて既読にする
            </button>
          )}
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">読み込み中...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p>通知はありません</p>
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                  !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{notification.content}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {format(new Date(notification.createdAt), 'MMM d, HH:mm')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {!notification.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        title="既読にする"
                      >
                        <Check className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(notification.id)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
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
