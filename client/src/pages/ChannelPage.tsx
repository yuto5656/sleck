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
    setShowMembers(true)
    setShowSettings(false)
  }

  const handleShowSettings = () => {
    setShowSettings(true)
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
