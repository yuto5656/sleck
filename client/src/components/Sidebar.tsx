import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Hash, Lock, Plus, ChevronDown, ChevronRight, MessageSquare, UserPlus } from 'lucide-react'
import clsx from 'clsx'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useDMStore } from '../stores/dmStore'
import CreateChannelModal from './CreateChannelModal'
import InviteModal from './InviteModal'

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { channels, currentChannel, setCurrentChannel } = useWorkspaceStore()
  const { dms, currentDM, setCurrentDM } = useDMStore()

  const [channelsExpanded, setChannelsExpanded] = useState(true)
  const [dmsExpanded, setDmsExpanded] = useState(true)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showInvite, setShowInvite] = useState(false)

  const handleChannelClick = (channel: typeof channels[0]) => {
    setCurrentChannel(channel)
    setCurrentDM(null)
    navigate(`/channel/${channel.id}`)
  }

  const handleDMClick = (dm: typeof dms[0]) => {
    setCurrentDM(dm)
    setCurrentChannel(null)
    navigate(`/dm/${dm.id}`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'dnd': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }

  return (
    <aside className="w-64 bg-sidebar text-sidebar-text flex flex-col">
      {/* Channels Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => setChannelsExpanded(!channelsExpanded)}
            className="flex items-center gap-1 text-sidebar-text-muted hover:text-sidebar-text w-full text-left text-sm"
          >
            {channelsExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <span>チャンネル</span>
          </button>

          {channelsExpanded && (
            <div className="mt-1 space-y-0.5">
              {channels.map((channel) => (
                <button
                  type="button"
                  key={channel.id}
                  onClick={() => handleChannelClick(channel)}
                  className={clsx(
                    'flex items-center gap-2 w-full px-2 py-1 rounded text-sm text-left',
                    currentChannel?.id === channel.id && location.pathname.startsWith('/channel')
                      ? 'bg-sidebar-active text-white'
                      : 'text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text'
                  )}
                >
                  {channel.isPrivate ? (
                    <Lock className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <Hash className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span className="truncate">{channel.name}</span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setShowCreateChannel(true)}
                className="flex items-center gap-2 w-full px-2 py-1 rounded text-sm text-left text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text"
              >
                <Plus className="w-4 h-4" />
                <span>チャンネルを追加</span>
              </button>
            </div>
          )}
        </div>

        {/* Invite Section */}
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 w-full px-2 py-1 rounded text-sm text-left text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text"
          >
            <UserPlus className="w-4 h-4" />
            <span>メンバーを招待</span>
          </button>
        </div>

        {/* DMs Section */}
        <div className="px-3 py-2">
          <button
            type="button"
            onClick={() => setDmsExpanded(!dmsExpanded)}
            className="flex items-center gap-1 text-sidebar-text-muted hover:text-sidebar-text w-full text-left text-sm"
          >
            {dmsExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <span>ダイレクトメッセージ</span>
          </button>

          {dmsExpanded && (
            <div className="mt-1 space-y-0.5">
              {dms.map((dm) => (
                <button
                  type="button"
                  key={dm.id}
                  onClick={() => handleDMClick(dm)}
                  className={clsx(
                    'flex items-center gap-2 w-full px-2 py-1 rounded text-sm text-left',
                    currentDM?.id === dm.id && location.pathname.startsWith('/dm')
                      ? 'bg-sidebar-active text-white'
                      : 'text-sidebar-text-muted hover:bg-sidebar-hover hover:text-sidebar-text'
                  )}
                >
                  <div className="relative">
                    <div className="w-5 h-5 rounded bg-gray-500 flex items-center justify-center text-xs">
                      {dm.participant.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div
                      className={clsx(
                        'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-sidebar',
                        getStatusColor(dm.participant.status)
                      )}
                    />
                  </div>
                  <span className="truncate">{dm.participant.displayName}</span>
                </button>
              ))}

              {dms.length === 0 && (
                <div className="flex items-center gap-2 px-2 py-1 text-sm text-sidebar-text-muted">
                  <MessageSquare className="w-4 h-4" />
                  <span>ダイレクトメッセージはありません</span>
                </div>
              )}
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
    </aside>
  )
}
