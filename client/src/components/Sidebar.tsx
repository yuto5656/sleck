import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Hash, Lock, Plus, ChevronDown, ChevronRight, MessageSquare, UserPlus, Zap, Shield } from 'lucide-react'
import clsx from 'clsx'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useDMStore } from '../stores/dmStore'
import { useUnreadStore } from '../stores/unreadStore'
import { useAuthStore } from '../stores/authStore'
import { getStatusColor } from '../utils/statusColors'
import CreateChannelModal from './CreateChannelModal'
import InviteModal from './InviteModal'
import NewDMModal from './NewDMModal'
import UserManagementPanel from './UserManagementPanel'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { channels, currentChannel, setCurrentChannel } = useWorkspaceStore()
  const { dms, currentDM, setCurrentDM } = useDMStore()
  const { unreadChannels, unreadDMs, markChannelRead, markDMRead } = useUnreadStore()
  const { user } = useAuthStore()

  const [channelsExpanded, setChannelsExpanded] = useState(true)
  const [dmsExpanded, setDmsExpanded] = useState(true)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showNewDM, setShowNewDM] = useState(false)
  const [showUserManagement, setShowUserManagement] = useState(false)

  const handleChannelClick = (channel: typeof channels[0]) => {
    setCurrentChannel(channel)
    setCurrentDM(null)
    markChannelRead(channel.id)
    navigate(`/channel/${channel.id}`)
  }

  const handleDMClick = (dm: typeof dms[0]) => {
    setCurrentDM(dm)
    setCurrentChannel(null)
    markDMRead(dm.id)
    navigate(`/dm/${dm.id}`)
  }

  return (
    <aside className="w-64 bg-gradient-dark text-sidebar-text flex flex-col border-r border-white/5">
      {/* Channels Section */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-3 mb-4">
          <button
            type="button"
            onClick={() => setChannelsExpanded(!channelsExpanded)}
            className="flex items-center gap-2 text-sidebar-text-muted hover:text-sidebar-text w-full text-left text-xs font-semibold uppercase tracking-wider px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all duration-200"
          >
            {channelsExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>チャンネル</span>
            <span className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{channels.length}</span>
          </button>

          {channelsExpanded && (
            <div className="mt-2 space-y-0.5">
              {channels.map((channel) => {
                const isActive = currentChannel?.id === channel.id && location.pathname.startsWith('/channel')
                const isUnread = unreadChannels.has(channel.id)
                return (
                  <button
                    type="button"
                    key={channel.id}
                    onClick={() => handleChannelClick(channel)}
                    className={clsx(
                      'flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-left transition-all duration-200 border',
                      isActive
                        ? 'bg-gradient-to-r from-primary-500/20 to-accent-500/20 text-white shadow-glow/20 border-primary-500/30'
                        : isUnread
                          ? 'text-white bg-white/10 hover:bg-white/15 border-transparent'
                          : 'text-sidebar-text-muted hover:bg-white/5 hover:text-sidebar-text border-transparent'
                    )}
                  >
                    <div className={clsx(
                      'w-6 h-6 rounded-lg flex items-center justify-center',
                      isActive ? 'bg-primary-500/30' : isUnread ? 'bg-primary-500/40' : 'bg-white/10'
                    )}>
                      {channel.isPrivate ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Hash className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span className={clsx('truncate', isUnread ? 'font-bold' : 'font-medium')}>{channel.name}</span>
                    {isUnread && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-primary-400" />
                    )}
                  </button>
                )
              })}

              {(user?.role === 'admin' || user?.role === 'deputy_admin') && (
                <button
                  type="button"
                  onClick={() => setShowCreateChannel(true)}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-left text-sidebar-text-muted hover:bg-white/5 hover:text-sidebar-text transition-all duration-200 group"
                >
                  <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-primary-500/30 transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <span>チャンネルを追加</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Invite Section */}
        <div className="px-3 mb-4">
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-left text-sidebar-text-muted hover:bg-white/5 hover:text-sidebar-text transition-all duration-200 group"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent-500/20 to-primary-500/20 flex items-center justify-center group-hover:from-accent-500/40 group-hover:to-primary-500/40 transition-colors">
              <UserPlus className="w-3.5 h-3.5" />
            </div>
            <span>メンバーを招待</span>
            <Zap className="w-3 h-3 ml-auto text-accent-400" />
          </button>

          {/* Admin Section */}
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setShowUserManagement(true)}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-left text-sidebar-text-muted hover:bg-white/5 hover:text-sidebar-text transition-all duration-200 group mt-1"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center group-hover:from-yellow-500/40 group-hover:to-orange-500/40 transition-colors">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <span>ユーザー管理</span>
            </button>
          )}
        </div>

        {/* DMs Section */}
        <div className="px-3">
          <button
            type="button"
            onClick={() => setDmsExpanded(!dmsExpanded)}
            className="flex items-center gap-2 text-sidebar-text-muted hover:text-sidebar-text w-full text-left text-xs font-semibold uppercase tracking-wider px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all duration-200"
          >
            {dmsExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>ダイレクトメッセージ</span>
            <span className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">{dms.length}</span>
          </button>

          {dmsExpanded && (
            <div className="mt-2 space-y-0.5">
              {dms.map((dm) => {
                const isActive = currentDM?.id === dm.id && location.pathname.startsWith('/dm')
                const isUnread = unreadDMs.has(dm.id)
                return (
                  <button
                    type="button"
                    key={dm.id}
                    onClick={() => handleDMClick(dm)}
                    className={clsx(
                      'flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-left transition-all duration-200 border',
                      isActive
                        ? 'bg-gradient-to-r from-primary-500/20 to-accent-500/20 text-white shadow-glow/20 border-primary-500/30'
                        : isUnread
                          ? 'text-white bg-white/10 hover:bg-white/15 border-transparent'
                          : 'text-sidebar-text-muted hover:bg-white/5 hover:text-sidebar-text border-transparent'
                    )}
                  >
                    <div className="relative">
                      <div className={clsx(
                        'w-7 h-7 rounded-xl flex items-center justify-center text-xs font-semibold',
                        isActive
                          ? 'bg-gradient-to-br from-emerald-400 to-cyan-500'
                          : isUnread
                            ? 'bg-gradient-to-br from-primary-400 to-accent-500'
                            : 'bg-gradient-to-br from-gray-500 to-gray-600'
                      )}>
                        {dm.participant.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div
                        className={clsx(
                          'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar',
                          getStatusColor(dm.participant.status)
                        )}
                      />
                    </div>
                    <span className={clsx('truncate', isUnread ? 'font-bold' : 'font-medium')}>{dm.participant.displayName}</span>
                    {isUnread && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-primary-400" />
                    )}
                  </button>
                )
              })}

              {dms.length === 0 && (
                <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-sidebar-text-muted">
                  <MessageSquare className="w-4 h-4" />
                  <span>DMはまだありません</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowNewDM(true)}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-left text-sidebar-text-muted hover:bg-white/5 hover:text-sidebar-text transition-all duration-200 group"
              >
                <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-primary-500/30 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <span>新しいメッセージ</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreateChannel && (
        <CreateChannelModal onClose={() => setShowCreateChannel(false)} />
      )}

      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} />
      )}

      {showNewDM && (
        <NewDMModal onClose={() => setShowNewDM(false)} />
      )}

      {showUserManagement && (
        <UserManagementPanel onClose={() => setShowUserManagement(false)} />
      )}
    </aside>
  )
}
