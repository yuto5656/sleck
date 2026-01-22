import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Hash, Lock, Settings, Users } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useMessageStore } from '../stores/messageStore'
import { useAuthStore } from '../stores/authStore'
import { socketService } from '../services/socket'
import { channelApi } from '../services/api'
import MessageList from '../components/MessageList'
import MessageInput from '../components/MessageInput'
import MembersPanel from '../components/MembersPanel'
import ChannelSettingsPanel from '../components/ChannelSettingsPanel'

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { channels, currentChannel, setCurrentChannel, deleteChannel } = useWorkspaceStore()
  const { messages, isLoading, hasMore, loadMessages, sendMessage, addMessage } = useMessageStore()
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [showMembers, setShowMembers] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

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
      // Only add message if it belongs to this channel
      if (message.channelId === channelId) {
        addMessage(channelId, message)
      }
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

  const handleLoadMore = useCallback(() => {
    if (channelId) {
      const channelMessages = messages.get(channelId) || []
      const oldestMessage = channelMessages[0]
      if (oldestMessage) {
        loadMessages(channelId, oldestMessage.id)
      }
    }
  }, [channelId, messages, loadMessages])

  const handleShowMembers = () => {
    setShowMembers((prev) => !prev)
    setShowSettings(false)
  }

  const handleShowSettings = () => {
    setShowSettings((prev) => !prev)
    setShowMembers(false)
  }

  const handleDeleteChannel = async () => {
    if (!channelId) return
    await deleteChannel(channelId)
    setShowSettings(false)
    navigate('/')
  }

  const channelMessages = channelId ? messages.get(channelId) || [] : []
  const channelHasMore = channelId ? hasMore.get(channelId) || false : false

  if (!currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 bg-surface-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900 dark:to-accent-900 flex items-center justify-center">
            <Hash className="w-8 h-8 text-primary-500" />
          </div>
          <p className="font-medium">チャンネルを選択してチャットを始めましょう</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-50 dark:bg-gray-900">
      {/* Channel header */}
      <div className="h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-surface-200 dark:border-gray-700 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900 dark:to-accent-900 flex items-center justify-center">
            {currentChannel.isPrivate ? (
              <Lock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            ) : (
              <Hash className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            )}
          </div>
          <div>
            <h1 className="font-semibold text-lg text-gray-900 dark:text-white">{currentChannel.name}</h1>
            {currentChannel.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-md">{currentChannel.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShowMembers}
            className={`p-2.5 rounded-xl transition-all duration-200 ${showMembers ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400' : 'hover:bg-surface-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
            title="メンバー"
          >
            <Users className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleShowSettings}
            className={`p-2.5 rounded-xl transition-all duration-200 ${showSettings ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400' : 'hover:bg-surface-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
            title="設定"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={channelMessages}
        isLoading={isLoading}
        hasMore={channelHasMore}
        onLoadMore={handleLoadMore}
      />

      {/* Typing indicator and Message input - fixed at bottom */}
      <div className="flex-shrink-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-surface-200 dark:border-gray-700">
        {typingUsers.length > 0 && (
          <div className="px-6 py-2 text-sm text-primary-600 dark:text-primary-400 flex items-center gap-2">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
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
      {showMembers && channelId && (
        <MembersPanel
          channelId={channelId}
          onClose={() => setShowMembers(false)}
        />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <ChannelSettingsPanel
          channel={currentChannel}
          onClose={() => setShowSettings(false)}
          onDelete={handleDeleteChannel}
        />
      )}
    </div>
  )
}
