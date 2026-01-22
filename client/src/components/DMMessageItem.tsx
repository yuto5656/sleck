import { useState, memo } from 'react'
import { format } from 'date-fns'
import { Smile, Edit2, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { DMMessage } from '../types'
import { useDMStore } from '../stores/dmStore'
import { useAuthStore } from '../stores/authStore'
import { useConfirmDialog } from './ConfirmDialog'
import { useToast } from './Toast'
import { getErrorMessage } from '../utils/errorUtils'
import { formatMentions } from '../utils/mentionUtils'
import { getAvatarUrl } from '../utils/avatarUrl'
import EmojiPicker from 'emoji-picker-react'

interface DMMessageItemProps {
  message: DMMessage
  showHeader: boolean
  isOwn: boolean
  dmId: string
  participantNames: string[] // Valid user names for mention validation
}

function arePropsEqual(prevProps: DMMessageItemProps, nextProps: DMMessageItemProps) {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isEdited === nextProps.message.isEdited &&
    prevProps.showHeader === nextProps.showHeader &&
    prevProps.isOwn === nextProps.isOwn &&
    prevProps.participantNames.length === nextProps.participantNames.length
  )
}

const DMMessageItem = memo(function DMMessageItem({ message, showHeader, isOwn, dmId, participantNames }: DMMessageItemProps) {
  const { user } = useAuthStore()
  const { editMessage, deleteMessage } = useDMStore()
  const { showConfirm } = useConfirmDialog()
  const toast = useToast()
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  const handleEmojiSelect = (emojiData: { emoji: string }) => {
    setEditContent((prev) => prev + emojiData.emoji)
    setShowEmojiPicker(false)
  }

  const handleEdit = async () => {
    if (editContent.trim() && editContent !== message.content) {
      try {
        await editMessage(dmId, message.id, editContent)
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
        await deleteMessage(dmId, message.id)
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
          <div className="w-9 h-9 rounded bg-gray-300 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200">
            {getAvatarUrl(message.sender.avatarUrl) ? (
              <img
                src={getAvatarUrl(message.sender.avatarUrl)!}
                alt={message.sender.displayName}
                className="w-full h-full rounded object-cover"
              />
            ) : (
              message.sender.displayName.charAt(0).toUpperCase()
            )}
          </div>
        ) : (
          <div className="w-9 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          {showHeader && (
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-gray-900 dark:text-white">{message.sender.displayName}</span>
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
              {formatMentions(message.content, participantNames, user?.displayName)}
            </div>
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
            title="絵文字を追加"
          >
            <Smile className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
          {isOwn && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                title="編集"
              >
                <Edit2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                title="削除"
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

export default DMMessageItem
