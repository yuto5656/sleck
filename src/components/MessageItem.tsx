import { useState } from 'react'
import { format } from 'date-fns'
import { MoreHorizontal, Smile, MessageSquare, Edit2, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import ReactMarkdown from 'react-markdown'
import { Message } from '../types'
import { useMessageStore } from '../stores/messageStore'
import { useAuthStore } from '../stores/authStore'
import EmojiPicker from 'emoji-picker-react'

interface MessageItemProps {
  message: Message
  showHeader: boolean
  isOwn: boolean
}

export default function MessageItem({ message, showHeader, isOwn }: MessageItemProps) {
  const { user } = useAuthStore()
  const { addReaction, removeReaction, editMessage, deleteMessage } = useMessageStore()
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  const handleReactionClick = (emoji: string) => {
    const hasReacted = message.reactions.find(
      (r) => r.emoji === emoji && r.users.includes(user?.id || '')
    )

    if (hasReacted) {
      removeReaction(message.id, emoji)
    } else {
      addReaction(message.id, emoji)
    }
  }

  const handleEmojiSelect = (emojiData: { emoji: string }) => {
    addReaction(message.id, emojiData.emoji)
    setShowEmojiPicker(false)
  }

  const handleEdit = async () => {
    if (editContent.trim() && editContent !== message.content) {
      await editMessage(message.id, editContent)
    }
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this message?')) {
      await deleteMessage(message.id)
    }
  }

  return (
    <div
      className={clsx(
        'group relative px-4 py-1 -mx-4 hover:bg-gray-50',
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
          <div className="w-9 h-9 rounded bg-gray-300 flex-shrink-0 flex items-center justify-center text-sm font-medium">
            {message.user.avatarUrl ? (
              <img
                src={message.user.avatarUrl}
                alt={message.user.displayName}
                className="w-full h-full rounded object-cover"
              />
            ) : (
              message.user.displayName.charAt(0).toUpperCase()
            )}
          </div>
        ) : (
          <div className="w-9 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          {showHeader && (
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-gray-900">{message.user.displayName}</span>
              <span className="text-xs text-gray-500">
                {format(new Date(message.createdAt), 'HH:mm')}
              </span>
              {message.isEdited && (
                <span className="text-xs text-gray-400">(edited)</span>
              )}
            </div>
          )}

          {isEditing ? (
            <div className="mt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-800 break-words prose prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
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
                    <div className="flex items-center gap-2 p-2 border rounded bg-gray-50 hover:bg-gray-100">
                      <span className="text-sm text-gray-700">{file.originalName}</span>
                      <span className="text-xs text-gray-500">
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
                  className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border',
                    reaction.users.includes(user?.id || '')
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span className="text-xs text-gray-600">{reaction.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Thread indicator */}
          {message.threadCount > 0 && (
            <button type="button" className="mt-1 flex items-center gap-1 text-sm text-blue-600 hover:underline">
              <MessageSquare className="w-4 h-4" />
              <span>{message.threadCount} replies</span>
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {showActions && !isEditing && (
        <div className="absolute top-0 right-4 -translate-y-1/2 flex items-center gap-1 bg-white border rounded shadow-sm">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 hover:bg-gray-100 rounded"
            title="Add reaction"
          >
            <Smile className="w-4 h-4 text-gray-500" />
          </button>
          <button type="button" className="p-1.5 hover:bg-gray-100 rounded" title="Reply in thread">
            <MessageSquare className="w-4 h-4 text-gray-500" />
          </button>
          {isOwn && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1.5 hover:bg-gray-100 rounded"
                title="Edit"
              >
                <Edit2 className="w-4 h-4 text-gray-500" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 hover:bg-gray-100 rounded"
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
}
