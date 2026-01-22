import { useState, memo } from 'react'
import { format } from 'date-fns'
import { Smile, MessageSquare, Edit2, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { Message } from '../types'
import { useMessageStore } from '../stores/messageStore'
import { useAuthStore } from '../stores/authStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useConfirmDialog } from './ConfirmDialog'
import { useToast } from './Toast'
import { getErrorMessage } from '../utils/errorUtils'
import { formatMentions } from '../utils/mentionUtils'
import { getAvatarUrl } from '../utils/avatarUrl'
import EmojiPicker from 'emoji-picker-react'

interface MessageItemProps {
  message: Message
  showHeader: boolean
  isOwn: boolean
  onOpenThread?: (message: Message) => void
  onUserClick?: (userId: string) => void
}

// Custom comparison function for React.memo
function arePropsEqual(prevProps: MessageItemProps, nextProps: MessageItemProps) {
  // Deep compare reactions for optimistic updates
  const reactionsEqual =
    prevProps.message.reactions.length === nextProps.message.reactions.length &&
    prevProps.message.reactions.every((prevR, i) => {
      const nextR = nextProps.message.reactions[i]
      return nextR &&
        prevR.emoji === nextR.emoji &&
        prevR.count === nextR.count &&
        prevR.users.length === nextR.users.length
    })

  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isEdited === nextProps.message.isEdited &&
    reactionsEqual &&
    prevProps.message.threadCount === nextProps.message.threadCount &&
    prevProps.showHeader === nextProps.showHeader &&
    prevProps.isOwn === nextProps.isOwn
  )
}

const MessageItem = memo(function MessageItem({ message, showHeader, isOwn, onOpenThread, onUserClick }: MessageItemProps) {
  const { user } = useAuthStore()
  const { members } = useWorkspaceStore()
  const { addReaction, removeReaction, editMessage, deleteMessage } = useMessageStore()

  // Get valid user names for mention validation
  const validUserNames = members.map(m => m.displayName)

  // Helper function to get user names from IDs for reaction tooltip
  const getReactionUserNames = (userIds: string[]): string => {
    const names = userIds.map(id => {
      if (id === user?.id) return 'あなた'
      const member = members.find(m => m.id === id)
      return member?.displayName || '不明なユーザー'
    })
    return names.join('、')
  }
  const { showConfirm } = useConfirmDialog()
  const toast = useToast()
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  const handleReactionClick = (emoji: string) => {
    if (!user) return
    const hasReacted = message.reactions.find(
      (r) => r.emoji === emoji && r.users.includes(user.id)
    )

    if (hasReacted) {
      removeReaction(message.id, emoji, user.id)
    } else {
      addReaction(message.id, emoji, user.id)
    }
  }

  const handleEmojiSelect = (emojiData: { emoji: string }) => {
    if (!user) return
    addReaction(message.id, emojiData.emoji, user.id)
    setShowEmojiPicker(false)
  }

  const handleEdit = async () => {
    if (editContent.trim() && editContent !== message.content) {
      try {
        await editMessage(message.id, editContent)
      } catch (error) {
        toast.error(getErrorMessage(error, 'メッセージの編集に失敗しました'))
        return
      }
    }
    setIsEditing(false)
  }

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: 'メッセージを削除',
      message: 'このメッセージを削除しますか？この操作は取り消せません。',
      confirmText: '削除',
      cancelText: 'キャンセル',
      danger: true,
    })

    if (confirmed) {
      try {
        await deleteMessage(message.id)
        toast.success('メッセージを削除しました')
      } catch (error) {
        toast.error(getErrorMessage(error, 'メッセージの削除に失敗しました'))
      }
    }
  }

  return (
    <div
      className={clsx(
        'group relative px-4 py-1 -mx-4 hover:bg-gray-50 dark:hover:bg-gray-800',
        showHeader && 'mt-3'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false)
        if (!showEmojiPicker) setShowEmojiPicker(false)
      }}
    >
      <div className="flex gap-2">
        {showHeader ? (
          <button
            type="button"
            onClick={() => onUserClick?.(message.user.id)}
            className="w-9 h-9 rounded bg-gray-300 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200 hover:opacity-80 transition-opacity cursor-pointer"
          >
            {getAvatarUrl(message.user.avatarUrl) ? (
              <img
                src={getAvatarUrl(message.user.avatarUrl)!}
                alt={message.user.displayName}
                className="w-full h-full rounded object-cover"
              />
            ) : (
              message.user.displayName.charAt(0).toUpperCase()
            )}
          </button>
        ) : (
          <div className="w-9 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          {showHeader && (
            <div className="flex items-baseline gap-2">
              <button
                type="button"
                onClick={() => onUserClick?.(message.user.id)}
                className="font-bold text-gray-900 dark:text-white hover:underline cursor-pointer"
              >
                {message.user.displayName}
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {format(new Date(message.createdAt), 'HH:mm')}
              </span>
              {message.isEdited && (
                <span className="text-xs text-gray-400 dark:text-gray-500">(edited)</span>
              )}
            </div>
          )}

          {isEditing ? (
            <div className="mt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 border dark:border-gray-600 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleEdit()
                  }
                  if (e.key === 'Escape') {
                    setIsEditing(false)
                    setEditContent(message.content)
                  }
                }}
              />
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setEditContent(message.content)
                  }}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-800 dark:text-gray-200 break-words">
              {formatMentions(message.content, validUserNames, user?.displayName)}
            </div>
          )}

          {/* Files */}
          {message.files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.files.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {file.mimeType.startsWith('image/') ? (
                    <img
                      src={file.url}
                      alt={file.originalName}
                      className="max-w-xs max-h-48 rounded border"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-2 border dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600">
                      <span className="text-sm text-gray-700 dark:text-gray-200">{file.originalName}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({Math.round(file.size / 1024)}KB)
                      </span>
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}

          {/* Reactions */}
          {message.reactions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {message.reactions.map((reaction) => (
                <button
                  type="button"
                  key={reaction.emoji}
                  onClick={() => handleReactionClick(reaction.emoji)}
                  title={getReactionUserNames(reaction.users)}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border',
                    reaction.users.includes(user?.id || '')
                      ? 'bg-blue-50 dark:bg-blue-900 border-blue-300 dark:border-blue-700'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">{reaction.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Thread indicator */}
          {message.threadCount > 0 && (
            <button
              type="button"
              onClick={() => onOpenThread?.(message)}
              className="mt-1 flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{message.threadCount} 件の返信</span>
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {showActions && !isEditing && (
        <div className="absolute top-0 right-4 -translate-y-1/2 flex items-center gap-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-sm">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
            title="Add reaction"
          >
            <Smile className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
          <button
            type="button"
            onClick={() => onOpenThread?.(message)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
            title="スレッドで返信"
          >
            <MessageSquare className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
          {isOwn && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                title="Edit"
              >
                <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="absolute top-8 right-4 z-50">
          <EmojiPicker onEmojiClick={handleEmojiSelect} />
        </div>
      )}
    </div>
  )
}, arePropsEqual)

export default MessageItem
