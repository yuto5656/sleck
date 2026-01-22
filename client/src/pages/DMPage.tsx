import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Circle } from 'lucide-react'
import clsx from 'clsx'
import { useDMStore } from '../stores/dmStore'
import { socketService } from '../services/socket'
import { useAuthStore } from '../stores/authStore'
import { getStatusColor } from '../utils/statusColors'
import { getAvatarUrl } from '../utils/avatarUrl'
import { formatDateDivider, shouldShowDateDivider, shouldShowMessageHeader } from '../utils/dateUtils'
import MessageInput from '../components/MessageInput'
import DMMessageItem from '../components/DMMessageItem'

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

  // Memoize date/time calculations
  const messageMetadata = useMemo(() => {
    const metadata = new Map<string, { dateString: string; timestamp: number }>()
    dmMessages.forEach((msg) => {
      const date = new Date(msg.createdAt)
      metadata.set(msg.id, {
        dateString: date.toDateString(),
        timestamp: date.getTime(),
      })
    })
    return metadata
  }, [dmMessages])

  const getShowHeader = useCallback((currentSenderId: string, currentTimestamp: number, previousSenderId?: string, previousTimestamp?: number) => {
    return shouldShowMessageHeader(currentSenderId, currentTimestamp, previousSenderId, previousTimestamp)
  }, [])

  // Get participant names for mention validation (current user + DM participant)
  const participantNames = useMemo(() => {
    const names: string[] = []
    if (user) names.push(user.displayName)
    if (currentDM) names.push(currentDM.participant.displayName)
    return names
  }, [user, currentDM])

  if (!currentDM) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-surface-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900 dark:to-accent-900 flex items-center justify-center">
            <Circle className="w-8 h-8 text-primary-500" />
          </div>
          <p className="font-medium">会話を選択してチャットを始めましょう</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-50 dark:bg-gray-900">
      {/* DM header */}
      <div className="h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-surface-200 dark:border-gray-700 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-sm font-semibold text-white">
              {getAvatarUrl(currentDM.participant.avatarUrl) ? (
                <img
                  src={getAvatarUrl(currentDM.participant.avatarUrl)!}
                  alt={currentDM.participant.displayName}
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                currentDM.participant.displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div
              className={clsx(
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800',
                getStatusColor(currentDM.participant.status)
              )}
            />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-gray-900 dark:text-white">{currentDM.participant.displayName}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{currentDM.participant.status}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-4 py-2">
        {isLoading && dmHasMore && (
          <div className="text-center py-2 text-gray-500 dark:text-gray-400">メッセージを読み込み中...</div>
        )}

        {dmMessages.map((message, index) => {
          const previous = dmMessages[index - 1]
          const showDateDivider = shouldShowDateDivider(message.createdAt, previous?.createdAt)
          const currentMeta = messageMetadata.get(message.id)
          const previousMeta = previous ? messageMetadata.get(previous.id) : undefined
          const showHeader = getShowHeader(
            message.sender.id,
            currentMeta?.timestamp || 0,
            previous?.sender.id,
            previousMeta?.timestamp
          )

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

              <DMMessageItem
                message={message}
                showHeader={showHeader}
                isOwn={message.sender.id === user?.id}
                dmId={dmId!}
                participantNames={participantNames}
              />
            </div>
          )
        })}

        {dmMessages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center mb-4 text-white text-3xl font-semibold">
              {currentDM.participant.displayName.charAt(0).toUpperCase()}
            </div>
            <p className="text-lg font-medium text-gray-900 dark:text-white">{currentDM.participant.displayName}</p>
            <p className="text-sm mt-1">会話の始まりです。メッセージを送信しましょう！</p>
          </div>
        )}
      </div>

      {/* Typing indicator and Message input */}
      <div className="flex-shrink-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-surface-200 dark:border-gray-700">
        {isTyping && (
          <div className="px-6 py-2 text-sm text-primary-600 dark:text-primary-400 flex items-center gap-2">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {currentDM.participant.displayName}が入力中...
          </div>
        )}

        <MessageInput
          dmId={dmId}
          placeholder={`${currentDM.participant.displayName}へメッセージを送信`}
          onSend={handleSendMessage}
        />
      </div>
    </div>
  )
}
