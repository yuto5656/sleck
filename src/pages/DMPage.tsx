import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Phone, Video, MoreVertical, Circle } from 'lucide-react'
import clsx from 'clsx'
import { useDMStore } from '../stores/dmStore'
import { socketService } from '../services/socket'
import MessageInput from '../components/MessageInput'
import { format, isToday, isYesterday } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useAuthStore } from '../stores/authStore'

export default function DMPage() {
  const { dmId } = useParams<{ dmId: string }>()
  const { user } = useAuthStore()
  const { dms, currentDM, setCurrentDM, messages, isLoading, hasMore, loadMessages, sendMessage, addMessage } = useDMStore()
  const [isTyping, setIsTyping] = useState(false)

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

  const handleLoadMore = () => {
    if (dmId) {
      const dmMessages = messages.get(dmId) || []
      const oldestMessage = dmMessages[0]
      if (oldestMessage) {
        loadMessages(dmId, oldestMessage.id)
      }
    }
  }

  const dmMessages = dmId ? messages.get(dmId) || [] : []
  const dmHasMore = dmId ? hasMore.get(dmId) || false : false

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500'
      case 'away': return 'text-yellow-500'
      case 'dnd': return 'text-red-500'
      default: return 'text-gray-400'
    }
  }

  const formatDateDivider = (date: string) => {
    const d = new Date(date)
    if (isToday(d)) return '今日'
    if (isYesterday(d)) return '昨日'
    return format(d, 'yyyy年M月d日', { locale: ja })
  }

  const shouldShowDateDivider = (current: typeof dmMessages[0], previous: typeof dmMessages[0] | undefined) => {
    if (!previous) return true
    const currentDate = new Date(current.createdAt).toDateString()
    const previousDate = new Date(previous.createdAt).toDateString()
    return currentDate !== previousDate
  }

  if (!currentDM) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        会話を選択してチャットを始めましょう
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* DM header */}
      <div className="h-14 border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded bg-gray-300 flex items-center justify-center text-sm font-medium">
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
                getStatusColor(currentDM.participant.status)
              )}
            />
          </div>
          <div>
            <h1 className="font-bold">{currentDM.participant.displayName}</h1>
            <p className="text-xs text-gray-500 capitalize">{currentDM.participant.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded" title="音声通話">
            <Phone className="w-5 h-5 text-gray-500" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded" title="ビデオ通話">
            <Video className="w-5 h-5 text-gray-500" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded" title="その他">
            <MoreVertical className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading && dmHasMore && (
          <div className="text-center py-2 text-gray-500">メッセージを読み込み中...</div>
        )}

        {dmMessages.map((message, index) => {
          const previous = dmMessages[index - 1]
          const showDateDivider = shouldShowDateDivider(message, previous)
          const isOwn = message.sender.id === user?.id

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

              <div className={clsx('flex gap-2 mb-2', isOwn && 'flex-row-reverse')}>
                <div className="w-8 h-8 rounded bg-gray-300 flex-shrink-0 flex items-center justify-center text-xs font-medium">
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
                      isOwn ? 'bg-blue-500 text-white' : 'bg-gray-100'
                    )}
                  >
                    <p className="break-words">{message.content}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
                    {message.isEdited && <span>（編集済み）</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {dmMessages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-4">
              {currentDM.participant.displayName.charAt(0).toUpperCase()}
            </div>
            <p className="text-lg font-medium">{currentDM.participant.displayName}</p>
            <p className="text-sm">会話の始まりです</p>
          </div>
        )}
      </div>

      {/* Typing indicator */}
      {isTyping && (
        <div className="px-4 py-1 text-sm text-gray-500">
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
