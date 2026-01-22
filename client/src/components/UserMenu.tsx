import { useRef, useEffect } from 'react'
import { LogOut, Settings, User, Moon, Circle } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { getStatusColor } from '../utils/statusColors'

interface UserMenuProps {
  onClose: () => void
}

export default function UserMenu({ onClose }: UserMenuProps) {
  const { user, logout, updateStatus } = useAuthStore()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleLogout = async () => {
    await logout()
    onClose()
  }

  const handleStatusChange = async (status: 'online' | 'away' | 'dnd' | 'offline') => {
    await updateStatus(status)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed top-12 right-4 w-64 bg-white rounded-lg shadow-xl border z-50"
    >
      {/* User info */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded bg-gray-300 flex items-center justify-center text-lg font-medium">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-full h-full rounded object-cover"
              />
            ) : (
              user?.displayName?.charAt(0).toUpperCase() || '?'
            )}
          </div>
          <div>
            <p className="font-bold text-gray-900">{user?.displayName}</p>
            <p className="text-sm text-gray-500 capitalize flex items-center gap-1">
              <Circle className={`w-2 h-2 fill-current ${getStatusColor(user?.status || 'offline', 'text')}`} />
              {user?.status}
            </p>
          </div>
        </div>
      </div>

      {/* Status options */}
      <div className="p-2 border-b">
        <p className="px-3 py-1 text-xs text-gray-500 font-medium">ステータスを設定</p>
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
            className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 rounded"
          >
            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
            <span className="text-sm text-gray-700">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Menu items */}
      <div className="p-2">
        <button type="button" className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 rounded">
          <User className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700">プロフィール</span>
        </button>
        <button type="button" className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 rounded">
          <Settings className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700">設定</span>
        </button>
        <button type="button" className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 rounded">
          <Moon className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700">ダークモード</span>
        </button>
      </div>

      {/* Logout */}
      <div className="p-2 border-t">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 rounded text-red-600"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">サインアウト</span>
        </button>
      </div>
    </div>
  )
}
