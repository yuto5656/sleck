import { useState } from 'react'
import { X, Bell, Volume2, Monitor } from 'lucide-react'

interface SettingsModalProps {
  onClose: () => void
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [notifications, setNotifications] = useState(() => {
    return localStorage.getItem('settings_notifications') !== 'false'
  })
  const [sounds, setSounds] = useState(() => {
    return localStorage.getItem('settings_sounds') !== 'false'
  })
  const [desktopNotifications, setDesktopNotifications] = useState(() => {
    return localStorage.getItem('settings_desktop_notifications') !== 'false'
  })

  const handleNotificationsChange = (value: boolean) => {
    setNotifications(value)
    localStorage.setItem('settings_notifications', String(value))
  }

  const handleSoundsChange = (value: boolean) => {
    setSounds(value)
    localStorage.setItem('settings_sounds', String(value))
  }

  const handleDesktopNotificationsChange = async (value: boolean) => {
    if (value && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        return
      }
    }
    setDesktopNotifications(value)
    localStorage.setItem('settings_desktop_notifications', String(value))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">設定</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Notifications Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              通知
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">アプリ内通知</span>
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => handleNotificationsChange(e.target.checked)}
                  className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm text-gray-700">デスクトップ通知</span>
                  <p className="text-xs text-gray-400">新しいメッセージをデスクトップで通知</p>
                </div>
                <input
                  type="checkbox"
                  checked={desktopNotifications}
                  onChange={(e) => handleDesktopNotificationsChange(e.target.checked)}
                  className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                />
              </label>
            </div>
          </div>

          {/* Sound Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              サウンド
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-700">通知音</span>
                <input
                  type="checkbox"
                  checked={sounds}
                  onChange={(e) => handleSoundsChange(e.target.checked)}
                  className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                />
              </label>
            </div>
          </div>

          {/* Display Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              表示
            </h3>
            <p className="text-sm text-gray-500">
              ダークモードはユーザーメニューから切り替えできます
            </p>
          </div>
        </div>

        <div className="p-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
