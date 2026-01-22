import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Message } from '../types'
import { useAuthStore } from '../stores/authStore'
import { formatDateDivider, shouldShowDateDivider, shouldShowMessageHeader } from '../utils/dateUtils'
import MessageItem from './MessageItem'

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
}

export default function MessageList({ messages, isLoading, hasMore, onLoadMore }: MessageListProps) {
  const { user } = useAuthStore()
  const listRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, autoScroll])

  const handleScroll = useCallback(() => {
    if (!listRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

    setAutoScroll(isNearBottom)

    // Load more when near top
    if (scrollTop < 100 && hasMore && !isLoading) {
      onLoadMore()
    }
  }, [hasMore, isLoading, onLoadMore])

  // Memoize date/time calculations to avoid creating Date objects on every render
  const messageMetadata = useMemo(() => {
    const metadata = new Map<string, { dateString: string; timestamp: number }>()
    messages.forEach((msg) => {
      const date = new Date(msg.createdAt)
      metadata.set(msg.id, {
        dateString: date.toDateString(),
        timestamp: date.getTime(),
      })
    })
    return metadata
  }, [messages])

  const getShowHeader = useCallback((current: Message, previous: Message | undefined) => {
    const currentMeta = messageMetadata.get(current.id)
    const previousMeta = previous ? messageMetadata.get(previous.id) : undefined
    return shouldShowMessageHeader(
      current.user.id,
      currentMeta?.timestamp || 0,
      previous?.user.id,
      previousMeta?.timestamp
    )
  }, [messageMetadata])

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto px-4 py-2"
    >
      {isLoading && hasMore && (
        <div className="text-center py-2 text-gray-500">メッセージを読み込み中...</div>
      )}

      {messages.map((message, index) => {
        const previous = messages[index - 1]
        const showDateDivider = shouldShowDateDivider(message.createdAt, previous?.createdAt)
        const showHeader = getShowHeader(message, previous)

        return (
          <div key={message.id}>
            {showDateDivider && (
              <div className="flex items-center my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="px-4 text-xs font-medium text-gray-500">
                  {formatDateDivider(message.createdAt)}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}

            <MessageItem
              message={message}
              showHeader={showHeader}
              isOwn={message.user.id === user?.id}
            />
          </div>
        )
      })}

      {messages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <p className="text-lg">まだメッセージがありません</p>
          <p className="text-sm">最初のメッセージを送信しましょう！</p>
        </div>
      )}
    </div>
  )
}
