import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Hash, Lock, Settings, Users, X, Trash2 } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useMessageStore } from '../stores/messageStore'
import { useAuthStore } from '../stores/authStore'
import { socketService } from '../services/socket'
import { channelApi } from '../services/api'
import MessageList from '../components/MessageList'
import MessageInput from '../components/MessageInput'

interface ChannelMember {
  id: string
  displayName: string
  avatarUrl: string | null
  status: string
  joinedAt: string
}

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { channels, currentChannel, setCurrentChannel, deleteChannel } = useWorkspaceStore()
  const { messages, isLoading, hasMore, loadMessages, sendMessage, addMessage } = useMessageStore()
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [showMembers, setShowMembers] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [members, setMembers] = useState<ChannelMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const initChannel = async () => {
      if (channelId) {
        const channel = channels.find((c) => c.id === channelId)
        if (channel) {
          setCurrentChannel(channel)
        }

        // Try to join the channel (will do nothing if already a member)
        try {
          await channelApi.joinChannel(channelId)
        } catch {
          // Ignore errors - might already be a member or private channel
        }

        loadMessages(channelId)
      }
    }

    initChannel()
  }, [channelId, channels, setCurrentChannel, loadMessages])

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!channelId) return

    const cleanupNewMessage = socketService.onNewMessage((message) => {
      addMessage(channelId, message)
    })

    const cleanupTypingStart = socketService.onTypingStart((data) => {
      if (data.channelId === channelId) {
        setTypingUsers((prev) =>
          prev.includes(data.userId) ? prev : [...prev, data.userId]
        )
      }
    })

    const cleanupTypingStop = socketService.onTypingStop((data) => {
      if (data.channelId === channelId) {
        setTypingUsers((prev) => prev.filter((u) => u !== data.userId))
      }
    })

    return () => {
      cleanupNewMessage()
      cleanupTypingStart()
      cleanupTypingStop()
    }
  }, [channelId, addMessage])

  const handleSendMessage = async (content: string) => {
    if (channelId && user) {
      await sendMessage(channelId, content, {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl || null,
      })
    }
  }

  const handleLoadMore = () => {
    if (channelId) {
      const channelMessages = messages.get(channelId) || []
      const oldestMessage = channelMessages[0]
      if (oldestMessage) {
        loadMessages(channelId, oldestMessage.id)
      }
    }
  }

  const handleShowMembers = async () => {
    setShowMembers(true)
    setShowSettings(false)
    if (channelId && members.length === 0) {
      setMembersLoading(true)
      try {
        const response = await channelApi.getMembers(channelId)
        setMembers(response.data.members)
      } catch (error) {
        console.error('Failed to load members:', error)
      } finally {
        setMembersLoading(false)
      }
    }
  }

  const handleShowSettings = () => {
    setShowSettings(true)
    setShowMembers(false)
  }

  const handleDeleteChannel = async () => {
    if (!channelId || !currentChannel) return

    const confirmed = window.confirm(
      `チャンネル「${currentChannel.name}」を削除しますか？\nこの操作は取り消せません。すべてのメッセージも削除されます。`
    )

    if (!confirmed) return

    setIsDeleting(true)
    try {
      await deleteChannel(channelId)
      setShowSettings(false)
      navigate('/')
    } catch (error) {
      console.error('Failed to delete channel:', error)
      alert('チャンネルの削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'away': return 'bg-yellow-500'
      case 'dnd': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }

  const channelMessages = channelId ? messages.get(channelId) || [] : []
  const channelHasMore = channelId ? hasMore.get(channelId) || false : false

  if (!currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        チャンネルを選択してチャットを始めましょう
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Channel header */}
      <div className="h-14 border-b flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          {currentChannel.isPrivate ? (
            <Lock className="w-5 h-5 text-gray-500" />
          ) : (
            <Hash className="w-5 h-5 text-gray-500" />
          )}
          <h1 className="font-bold text-lg">{currentChannel.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShowMembers}
            className={`p-2 hover:bg-gray-100 rounded ${showMembers ? 'bg-gray-100' : ''}`}
            title="メンバー"
          >
            <Users className="w-5 h-5 text-gray-500" />
          </button>
          <button
            type="button"
            onClick={handleShowSettings}
            className={`p-2 hover:bg-gray-100 rounded ${showSettings ? 'bg-gray-100' : ''}`}
            title="設定"
          >
            <Settings className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Channel description */}
      {currentChannel.description && (
        <div className="px-4 py-2 text-sm text-gray-600 border-b flex-shrink-0">
          {currentChannel.description}
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={channelMessages}
        isLoading={isLoading}
        hasMore={channelHasMore}
        onLoadMore={handleLoadMore}
      />

      {/* Typing indicator and Message input - fixed at bottom */}
      <div className="flex-shrink-0">
        {typingUsers.length > 0 && (
          <div className="px-4 py-1 text-sm text-gray-500">
            {typingUsers.length === 1
              ? '誰かが入力中...'
              : `${typingUsers.length}人が入力中...`}
          </div>
        )}

        {/* Message input */}
        <MessageInput
          channelId={channelId}
          placeholder={`#${currentChannel.name}へメッセージを送信`}
          onSend={handleSendMessage}
        />
      </div>

      {/* Members Panel */}
      {showMembers && (
        <div className="fixed top-0 right-0 h-full w-80 bg-white border-l shadow-lg z-40 flex flex-col">
          <div className="h-14 border-b flex items-center justify-between px-4">
            <h2 className="font-bold">メンバー</h2>
            <button
              type="button"
              onClick={() => setShowMembers(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {membersLoading ? (
              <div className="text-center text-gray-500">読み込み中...</div>
            ) : members.length === 0 ? (
              <div className="text-center text-gray-500">メンバーがいません</div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded bg-gray-300 flex items-center justify-center text-sm font-medium">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.displayName}
                            className="w-full h-full rounded object-cover"
                          />
                        ) : (
                          member.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(member.status)}`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.displayName}</p>
                      <p className="text-xs text-gray-500 capitalize">{member.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed top-0 right-0 h-full w-80 bg-white border-l shadow-lg z-40 flex flex-col">
          <div className="h-14 border-b flex items-center justify-between px-4">
            <h2 className="font-bold">チャンネル設定</h2>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  チャンネル名
                </label>
                <p className="text-gray-900">
                  {currentChannel.isPrivate ? (
                    <Lock className="w-4 h-4 inline mr-1" />
                  ) : (
                    <Hash className="w-4 h-4 inline mr-1" />
                  )}
                  {currentChannel.name}
                </p>
              </div>
              {currentChannel.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    説明
                  </label>
                  <p className="text-gray-900">{currentChannel.description}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイプ
                </label>
                <p className="text-gray-900">
                  {currentChannel.isPrivate ? 'プライベート' : 'パブリック'}
                </p>
              </div>

              {/* Delete Channel */}
              <div className="pt-4 border-t mt-6">
                <label className="block text-sm font-medium text-red-600 mb-2">
                  危険な操作
                </label>
                <button
                  type="button"
                  onClick={handleDeleteChannel}
                  disabled={isDeleting}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? '削除中...' : 'チャンネルを削除'}
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  チャンネルを削除すると、すべてのメッセージも削除されます。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
