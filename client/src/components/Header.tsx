import { useState } from 'react'
import { Search, Bell, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import SearchModal from './SearchModal'
import UserMenu from './UserMenu'
import NotificationPanel from './NotificationPanel'
import WorkspaceMenu from './WorkspaceMenu'

export default function Header() {
  const { user } = useAuthStore()
  const { currentWorkspace } = useWorkspaceStore()
  const [showSearch, setShowSearch] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false)

  return (
    <header className="bg-slack-purple h-10 flex items-center px-4 text-white">
      <div className="flex-1 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
          className="flex items-center gap-1 hover:bg-white/10 rounded px-2 py-1"
        >
          <span className="font-bold text-lg">
            {currentWorkspace?.name || 'Sleck'}
          </span>
          <ChevronDown className="w-4 h-4" />
        </button>
        {showWorkspaceMenu && (
          <WorkspaceMenu onClose={() => setShowWorkspaceMenu(false)} />
        )}
      </div>

      <div className="flex-1 max-w-xl">
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm text-white/80"
        >
          <Search className="w-4 h-4" />
          <span>{currentWorkspace?.name}を検索</span>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setShowNotifications(!showNotifications)}
          className="relative p-1 hover:bg-white/10 rounded"
        >
          <Bell className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 hover:bg-white/10 rounded p-1"
        >
          <div className="w-7 h-7 rounded bg-green-500 flex items-center justify-center text-sm font-medium">
            {user?.displayName?.charAt(0).toUpperCase() || '?'}
          </div>
        </button>

        {showUserMenu && (
          <UserMenu onClose={() => setShowUserMenu(false)} />
        )}

        {showNotifications && (
          <NotificationPanel onClose={() => setShowNotifications(false)} />
        )}
      </div>

      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </header>
  )
}
