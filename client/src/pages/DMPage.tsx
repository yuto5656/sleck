import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Phone, Video, MoreVertical, Circle } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import { useDMStore } from '../stores/dmStore'
import { socketService } from '../services/socket'
import { useAuthStore } from '../stores/authStore'
import { getStatusColor } from '../utils/statusColors'
import { formatDateDivider, shouldShowDateDivider } from '../utils/dateUtils'
import MessageInput from '../components/MessageInput'

export default function DMPage() {
  const { dmId } = useParams<{ dmId: string }>()
  const { user } = useAuthStore()
  const { dms, currentDM, setCurrentDM, messages, isLoading, hasMore, loadMessages, sendMessage, addMessage } = useDMStore()
  const [isTyping, setIsTyping] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (dmId) {
      const dm = dms.find((d) => d.id === dmId)
      if (dm) {
        setCurrentDM(dm)
      }
      loadMessages(dmId)
    }
  }, [dmId, dms, setCurrentDM, loadMessages])

  // Socket listeners
  useEffect(() => {
    if (!dmId) return

    const cleanupNewDM = socketService.onNewDM((message) => {
      if (message.dmId === dmId) {
        addMessage(dmId, message)
      }
    })

    const cleanupTypingStart = socketService.onTypingStart((data) => {
      if (data.dmId === dmId) {
        setIsTyping(true)
      }
    })

    const cleanupTypingStop = socketService.onTypingStop((data) => {
      if (data.dmId === dmId) {
        setIsTyping(false)
      }
    })

    return () => {
      cleanupNewDM()
      cleanupTypingStart()
      cleanupTypingStop()
    }
  }, [dmId, addMessage])

  const handleSendMessage = async (content: string) => {
    if (dmId) {
      await sendMessage(dmId, content)
    }
  }

  const dmMessages = dmId ? messages.get(dmId) || [] : []
  const dmHasMore = dmId ? hasMore.get(dmId) || false : false

  const handleLoadMore = useCallback(() => {
    if (dmId && dmHasMore && !isLoading) {
      const oldestMessage = dmMessages[0]
      if (oldestMessage) {
        loadMessages(dmId, oldestMessage.id)
      }
    }
  }, [dmId, dmHasMore, isLoading, dmMessages, loadMessages])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    setAutoScroll(isNearBottom)

    // Load more when near top
    if (scrollTop < 100 && dmHasMore && !isLoading) {
      handleLoadMore()
    }
  }, [dmHasMore, isLoading, handleLoadMore])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [dmMessages, autoScroll])

  if (!currentDM) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-surface-50 dark:bg-gray-900">
        会話を選択してチャットを始めましょう
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-surface-50 dark:bg-gray-900">
      {/* DM header */}
      <div className="h-14 border-b dark:border-gray-700 flex items-center justify-between px-4 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200">
              {currentDM.participant.avatarUrl ? (
                <img
                  src={currentDM.participant.avatarUrl}
                  alt={currentDM.participant.displayName}
                  className="w-full h-full rounded object-cover"
                />
              ) : (
                currentDM.participant.displayName.charAt(0).toUpperCase()
              )}
            </div>
            <Circle
              className={clsx(
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 fill-current',
                getStatusColor(currentDM.participant.status, 'text')
              )}
            />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white">{currentDM.participant.displayName}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{currentDM.participant.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="音声通話">
            <Phone className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="ビデオ通話">
            <Video className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="その他">
            <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading && dmHasMore && (
          <div className="text-center py-2 text-gray-500 dark:text-gray-400">メッセージを読み込み中...</div>
        )}

        {dmMessages.map((message, index) => {
          const previous = dmMessages[index - 1]
          const showDateDivider = shouldShowDateDivider(message.createdAt, previous?.createdAt)
          const isOwn = message.sender.id === user?.id

          return (
            <div key={message.id}>
              {showDateDivider && (
                <div className="flex items-center my-4">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="px-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {formatDateDivider(message.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                </div>
              )}

              <div className={clsx('flex gap-2 mb-2', isOwn && 'flex-row-reverse')}>
                <div className="w-8 h-8 rounded bg-gray-300 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-200">
                  {message.sender.avatarUrl ? (
                    <img
                      src={message.sender.avatarUrl}
                      alt={message.sender.displayName}
                      className="w-full h-full rounded object-cover"
                    />
                  ) : (
                    message.sender.displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className={clsx('max-w-[70%]', isOwn && 'text-right')}>
                  <div
                    className={clsx(
                      'inline-block px-3 py-2 rounded-lg',
                      isOwn ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    )}
                  >
                    <p className="break-words">{message.content}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
                    {message.isEdited && <span>（編集済み）</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {dmMessages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4 text-gray-700 dark:text-gray-300 text-2xl font-semibold">
              {currentDM.participant.displayName.charAt(0).toUpperCase()}
            </div>
            <p className="text-lg font-medium text-gray-900 dark:text-white">{currentDM.participant.displayName}</p>
            <p className="text-sm">会話の始まりです</p>
          </div>
        )}
      </div>

      {/* Typing indicator */}
      {isTyping && (
        <div className="px-4 py-1 text-sm text-gray-500 dark:text-gray-400">
          {currentDM.participant.displayName}が入力中...
        </div>
      )}

      {/* Message input */}
      <MessageInput
        dmId={dmId}
        placeholder={`${currentDM.participant.displayName}へメッセージを送信`}
        onSend={handleSendMessage}
      />
    </div>
  )
}
