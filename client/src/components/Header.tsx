import { useState, useEffect } from 'react'
import { Search, Bell, ChevronDown, Sparkles, Menu } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useNotificationStore } from '../stores/notificationStore'
import SearchModal from './SearchModal'
import UserMenu from './UserMenu'
import NotificationPanel from './NotificationPanel'
import WorkspaceMenu from './WorkspaceMenu'

interface HeaderProps {
  onMenuClick?: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuthStore()
  const { currentWorkspace } = useWorkspaceStore()
  const { unreadCount, loadNotifications } = useNotificationStore()
  const [showSearch, setShowSearch] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)

  useEffect(() => {
    loadNotifications()
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [loadNotifications])

  return (
    <header className="bg-gradient-to-r from-sidebar to-slate-800 h-14 flex items-center px-2 md:px-4 text-white shadow-lg">
      <div className="flex-1 flex items-center gap-2 md:gap-4">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden p-2 hover:bg-white/10 rounded-xl transition-all duration-200"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setShowWorkspaceMenu((prev) => !prev)}
          className="flex items-center gap-2 hover:bg-white/10 rounded-xl px-2 md:px-3 py-2 transition-all duration-200"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center shadow-glow">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-semibold text-base md:text-lg truncate max-w-[100px] md:max-w-none">
            {currentWorkspace?.name || 'Sleck'}
          </span>
          <ChevronDown className="w-4 h-4 opacity-70 hidden sm:block" />
        </button>
        {showWorkspaceMenu && (
          <WorkspaceMenu onClose={() => setShowWorkspaceMenu(false)} />
        )}
      </div>

      {/* Search - hidden on small mobile */}
      <div className="hidden sm:block flex-1 max-w-xl">
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-3 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm text-white/80 transition-all duration-200 border border-white/10"
        >
          <Search className="w-4 h-4" />
          <span className="truncate">{currentWorkspace?.name}を検索</span>
          <span className="ml-auto text-xs bg-white/10 px-2 py-0.5 rounded-md hidden md:block">⌘K</span>
        </button>
      </div>

      {/* Mobile search button */}
      <button
        type="button"
        onClick={() => setShowSearch(true)}
        className="sm:hidden p-2 hover:bg-white/10 rounded-xl transition-all duration-200"
      >
        <Search className="w-5 h-5" />
      </button>

      <div className="flex-1 flex items-center justify-end gap-2">
        <button
          type="button"
          data-notification-trigger
          onClick={() => setShowNotifications((prev) => !prev)}
          className="relative p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full flex items-center justify-center font-medium shadow-lg animate-pulse-soft">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          data-user-menu-trigger
          onClick={() => setShowUserMenu((prev) => !prev)}
          className="flex items-center gap-2 hover:bg-white/10 rounded-xl p-1.5 transition-all duration-200"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-sm font-semibold shadow-lg ring-2 ring-white/20">
            {user?.displayName?.charAt(0).toUpperCase() || '?'}
          </div>
        </button>

        {showUserMenu && (
          <UserMenu onClose={() => setShowUserMenu(false)} triggerSelector="[data-user-menu-trigger]" />
        )}

        {showNotifications && (
          <NotificationPanel onClose={() => setShowNotifications(false)} triggerSelector="[data-notification-trigger]" />
        )}
      </div>

      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </header>
  )
}
