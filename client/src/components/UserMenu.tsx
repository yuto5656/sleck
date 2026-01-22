import { useRef, useEffect, useState } from 'react'
import { LogOut, Settings, User, Moon, Sun, Circle } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useThemeStore } from '../stores/themeStore'
import { getStatusColor } from '../utils/statusColors'
import { getAvatarUrl } from '../utils/avatarUrl'
import ProfileModal from './ProfileModal'
import SettingsModal from './SettingsModal'

interface UserMenuProps {
  onClose: () => void
  triggerSelector?: string
}

export default function UserMenu({ onClose, triggerSelector }: UserMenuProps) {
  const { user, logout, updateStatus } = useAuthStore()
  const { isDark, toggleDarkMode } = useThemeStore()
  const menuRef = useRef<HTMLDivElement>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if a modal is open
      if (showProfile || showSettings) {
        return
      }

      const target = e.target as Node
      // Don't close if clicking the trigger button (toggle will handle it)
      if (triggerSelector) {
        const trigger = document.querySelector(triggerSelector)
        if (trigger?.contains(target)) {
          return
        }
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, triggerSelector, showProfile, showSettings])

  const handleLogout = async () => {
    await logout()
    onClose()
  }

  const handleStatusChange = async (status: 'online' | 'away' | 'dnd' | 'offline') => {
    await updateStatus(status)
    onClose()
  }

  const handleDarkModeToggle = () => {
    toggleDarkMode()
  }

  const handleProfileClick = () => {
    setShowProfile(true)
  }

  const handleSettingsClick = () => {
    setShowSettings(true)
  }

  return (
    <>
      <div
        ref={menuRef}
        className="fixed top-12 right-4 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-50"
      >
        {/* User info */}
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-lg font-medium text-white">
              {getAvatarUrl(user?.avatarUrl) ? (
                <img
                  src={getAvatarUrl(user?.avatarUrl)!}
                  alt={user?.displayName}
                  className="w-full h-full rounded object-cover"
                />
              ) : (
                user?.displayName?.charAt(0).toUpperCase() || '?'
              )}
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white">{user?.displayName}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize flex items-center gap-1">
                <Circle className={`w-2 h-2 fill-current ${getStatusColor(user?.status || 'offline', 'text')}`} />
                {user?.status}
              </p>
            </div>
          </div>
        </div>

        {/* Status options */}
        <div className="p-2 border-b dark:border-gray-700">
          <p className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 font-medium">ステータスを設定</p>
          {[
            { status: 'online' as const, label: 'オンライン', color: 'bg-green-500' },
            { status: 'away' as const, label: '離席中', color: 'bg-yellow-500' },
            { status: 'dnd' as const, label: '取り込み中', color: 'bg-red-500' },
            { status: 'offline' as const, label: 'オフライン表示', color: 'bg-gray-400' },
          ].map((item) => (
            <button
              type="button"
              key={item.status}
              onClick={() => handleStatusChange(item.status)}
              className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
              <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Menu items */}
        <div className="p-2">
          <button
            type="button"
            onClick={handleProfileClick}
            className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">プロフィール</span>
          </button>
          <button
            type="button"
            onClick={handleSettingsClick}
            className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">設定</span>
          </button>
          <button
            type="button"
            onClick={handleDarkModeToggle}
            className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <Moon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            )}
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {isDark ? 'ライトモード' : 'ダークモード'}
            </span>
          </button>
        </div>

        {/* Logout */}
        <div className="p-2 border-t dark:border-gray-700">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-red-600"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">サインアウト</span>
          </button>
        </div>
      </div>

      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)} />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </>
  )
}
