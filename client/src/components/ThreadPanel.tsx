import { useEffect, useRef, useState } from 'react'
import { X, Send } from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'
import { useThreadStore } from '../stores/threadStore'
import { useAuthStore } from '../stores/authStore'
import { socketService } from '../services/socket'
import { Message } from '../types'

// Convert text with newlines to React nodes with <br /> elements
function formatNewlines(text: string, keyPrefix: string): React.ReactNode[] {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []

  lines.forEach((line, index) => {
    if (index > 0) {
      result.push(<br key={`${keyPrefix}-br-${index}`} />)
    }
    if (line) {
      result.push(line)
    }
  })

  return result
}

interface ThreadPanelProps {
  channelId: string
}

export default function ThreadPanel({ channelId }: ThreadPanelProps) {
  const { user } = useAuthStore()
  const { parentMessage, replies, isLoading, closeThread, sendReply, addReply, updateReply, removeReply, incrementThreadCount } = useThreadStore()
  const [replyContent, setReplyContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when replies change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies])

  // Listen for thread reply events
  useEffect(() => {
    if (!parentMessage) return

    const handleNewMessage = (message: Message) => {
      if (message.parentId === parentMessage.id) {
        addReply(message)
        incrementThreadCount()
      }
    }

    const handleMessageUpdate = (message: Message) => {
      updateReply(message)
    }

    const handleMessageDelete = (data: { id: string }) => {
      removeReply(data.id)
    }

    const cleanupNew = socketService.onNewMessage(handleNewMessage)
    const cleanupUpdate = socketService.onMessageUpdate(handleMessageUpdate)
    const cleanupDelete = socketService.onMessageDelete(handleMessageDelete)

    return () => {
      cleanupNew()
      cleanupUpdate()
      cleanupDelete()
    }
  }, [parentMessage, addReply, updateReply, removeReply, incrementThreadCount])

  const handleSend = async () => {
    if (!replyContent.trim() || !user) return

    setIsSending(true)
    try {
      await sendReply(channelId, replyContent.trim(), {
        id: user.id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      })
      setReplyContent('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      // Error handled in store
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReplyContent(e.target.value)
    // Auto-resize
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
  }

  if (!parentMessage) return null

  return (
    <div className="w-96 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">スレッド</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {parentMessage.threadCount} 件の返信
          </p>
        </div>
        <button
          type="button"
          onClick={closeThread}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-400 to-accent-500 flex-shrink-0 flex items-center justify-center text-sm font-medium text-white">
            {parentMessage.user.avatarUrl ? (
              <img
                src={parentMessage.user.avatarUrl}
                alt={parentMessage.user.displayName}
                className="w-full h-full rounded-lg object-cover"
              />
            ) : (
              parentMessage.user.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-gray-900 dark:text-white text-sm">
                {parentMessage.user.displayName}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {format(new Date(parentMessage.createdAt), 'M/d HH:mm')}
              </span>
            </div>
            <div className="text-gray-800 dark:text-gray-200 text-sm mt-1 break-words">
              {formatNewlines(parentMessage.content, 'parent')}
            </div>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
          </div>
        ) : replies.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500 dark:text-gray-400 text-sm">
              まだ返信がありません
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map((reply) => (
              <div key={reply.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex-shrink-0 flex items-center justify-center text-xs font-medium text-white">
                  {reply.user.avatarUrl ? (
                    <img
                      src={reply.user.avatarUrl}
                      alt={reply.user.displayName}
                      className="w-full h-full rounded-lg object-cover"
                    />
                  ) : (
                    reply.user.displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">
                      {reply.user.displayName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(reply.createdAt), 'HH:mm')}
                    </span>
                  </div>
                  <div className="text-gray-800 dark:text-gray-200 text-sm mt-0.5 break-words">
                    {formatNewlines(reply.content, `reply-${reply.id}`)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply input */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <div className={clsx(
          'flex items-end gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-2',
          'focus-within:ring-2 focus-within:ring-primary-500/20'
        )}>
          <textarea
            ref={textareaRef}
            value={replyContent}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            placeholder="返信を入力..."
            className="flex-1 resize-none outline-none max-h-32 py-1.5 px-2 leading-normal bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
            rows={1}
            disabled={isSending}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !replyContent.trim()}
            className={clsx(
              'p-2 rounded-lg transition-all duration-200',
              replyContent.trim()
                ? 'bg-primary-500 text-white hover:bg-primary-600'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
