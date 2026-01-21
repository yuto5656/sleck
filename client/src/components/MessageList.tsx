import { useEffect, useRef, useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Message } from '../types'
import { useAuthStore } from '../stores/authStore'
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

  const handleScroll = () => {
    if (!listRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

    setAutoScroll(isNearBottom)

    // Load more when near top
    if (scrollTop < 100 && hasMore && !isLoading) {
      onLoadMore()
    }
  }

  const formatDateDivider = (date: string) => {
    const d = new Date(date)
    if (isToday(d)) return '今日'
    if (isYesterday(d)) return '昨日'
    return format(d, 'yyyy年M月d日', { locale: ja })
  }

  const shouldShowDateDivider = (current: Message, previous: Message | undefined) => {
    if (!previous) return true
    const currentDate = new Date(current.createdAt).toDateString()
    const previousDate = new Date(previous.createdAt).toDateString()
    return currentDate !== previousDate
  }

  const shouldShowHeader = (current: Message, previous: Message | undefined) => {
    if (!previous) return true
    if (previous.user.id !== current.user.id) return true

    // Show header if more than 5 minutes apart
    const currentTime = new Date(current.createdAt).getTime()
    const previousTime = new Date(previous.createdAt).getTime()
    return currentTime - previousTime > 5 * 60 * 1000
  }

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-2"
    >
      {isLoading && hasMore && (
        <div className="text-center py-2 text-gray-500">メッセージを読み込み中...</div>
      )}

      {messages.map((message, index) => {
        const previous = messages[index - 1]
        const showDateDivider = shouldShowDateDivider(message, previous)
        const showHeader = shouldShowHeader(message, previous)

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
