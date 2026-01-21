import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Paperclip, Smile, AtSign } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import EmojiPicker from 'emoji-picker-react'
import clsx from 'clsx'
import { fileApi } from '../services/api'
import { socketService } from '../services/socket'
import { useWorkspaceStore } from '../stores/workspaceStore'

interface MentionMember {
  id: string
  displayName: string
  avatarUrl: string | null
  status: string
}

interface MessageInputProps {
  channelId?: string
  dmId?: string
  placeholder?: string
  onSend: (content: string, files?: File[]) => Promise<void>
}

export default function MessageInput({ channelId, dmId, placeholder = 'メッセージを送信', onSend }: MessageInputProps) {
  const { members } = useWorkspaceStore()
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showMentionList, setShowMentionList] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Filter members based on mention search
  const filteredMembers: MentionMember[] = showMentionList
    ? members.filter((m) =>
        m.displayName.toLowerCase().includes(mentionSearch.toLowerCase())
      ).slice(0, 5)
    : []

  // Reset mention index when filtered list changes
  useEffect(() => {
    setMentionIndex(0)
  }, [mentionSearch])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles].slice(0, 10))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    maxSize: 50 * 1024 * 1024, // 50MB
  })

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true)
      socketService.startTyping({ channelId, dmId })
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      socketService.stopTyping({ channelId, dmId })
    }, 3000)
  }

  const handleSend = async () => {
    const trimmedContent = content.trim()
    if (!trimmedContent && files.length === 0) return

    setIsSending(true)
    try {
      // Upload files first if any
      if (files.length > 0) {
        await fileApi.uploadMultiple(files)
      }

      await onSend(trimmedContent, files)
      setContent('')
      setFiles([])

      // Stop typing
      if (isTyping) {
        socketService.stopTyping({ channelId, dmId })
        setIsTyping(false)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle mention list navigation
    if (showMentionList && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((prev) => (prev + 1) % filteredMembers.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        handleMentionSelect(filteredMembers[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMentionList(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleEmojiSelect = (emojiData: { emoji: string }) => {
    setContent((prev) => prev + emojiData.emoji)
    setShowEmojiPicker(false)
    inputRef.current?.focus()
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setContent(value)
    handleTyping()

    // Check for mention trigger
    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = value.slice(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      setShowMentionList(true)
      setMentionSearch(mentionMatch[1])
    } else {
      setShowMentionList(false)
      setMentionSearch('')
    }
  }

  const handleMentionSelect = (member: MentionMember) => {
    const cursorPos = inputRef.current?.selectionStart || content.length
    const textBeforeCursor = content.slice(0, cursorPos)
    const textAfterCursor = content.slice(cursorPos)

    // Replace @search with @displayName
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/)
    if (mentionMatch) {
      const beforeMention = textBeforeCursor.slice(0, mentionMatch.index)
      const newContent = `${beforeMention}@${member.displayName} ${textAfterCursor}`
      setContent(newContent)
    }

    setShowMentionList(false)
    setMentionSearch('')
    inputRef.current?.focus()
  }

  const handleMentionButtonClick = () => {
    setContent((prev) => prev + '@')
    setShowMentionList(true)
    setMentionSearch('')
    inputRef.current?.focus()
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div {...getRootProps()} className="relative px-4 pb-4">
      {isDragActive && (
        <div className="absolute inset-0 bg-blue-50 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center z-10">
          <p className="text-blue-600 font-medium">ファイルをここにドロップ</p>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="relative group bg-gray-100 rounded p-2 pr-6"
            >
              <span className="text-sm text-gray-700 truncate max-w-xs block">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 w-4 h-4 bg-gray-300 rounded-full text-xs hover:bg-gray-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={clsx(
        'flex items-end gap-2 border rounded-lg p-2',
        isDragActive && 'border-blue-400 bg-blue-50'
      )}>
        <input {...getInputProps()} />

        <button
          type="button"
          onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
          className="p-2 hover:bg-gray-100 rounded"
          title="ファイルを添付"
        >
          <Paperclip className="w-5 h-5 text-gray-500" />
        </button>

        <textarea
          ref={inputRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 resize-none outline-none max-h-32"
          rows={1}
          disabled={isSending}
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 hover:bg-gray-100 rounded"
            title="絵文字"
          >
            <Smile className="w-5 h-5 text-gray-500" />
          </button>

          <button
            type="button"
            onClick={handleMentionButtonClick}
            className="p-2 hover:bg-gray-100 rounded"
            title="メンション"
          >
            <AtSign className="w-5 h-5 text-gray-500" />
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || (!content.trim() && files.length === 0)}
            className={clsx(
              'p-2 rounded',
              content.trim() || files.length > 0
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
            title="送信"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showEmojiPicker && (
        <div className="absolute bottom-full right-4 mb-2 z-50">
          <EmojiPicker onEmojiClick={handleEmojiSelect} />
        </div>
      )}

      {/* Mention list */}
      {showMentionList && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-4 mb-2 bg-white border rounded-lg shadow-lg z-50 w-64 max-h-48 overflow-y-auto">
          {filteredMembers.map((member, index) => (
            <button
              type="button"
              key={member.id}
              onClick={() => handleMentionSelect(member)}
              className={`w-full flex items-center gap-3 p-2 text-left hover:bg-gray-100 ${
                index === mentionIndex ? 'bg-blue-50' : ''
              }`}
            >
              <div className="w-8 h-8 rounded bg-gray-300 flex items-center justify-center text-sm font-medium flex-shrink-0">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.displayName}
                    className="w-full h-full rounded object-cover"
                  />
                ) : (
                  member.displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{member.displayName}</p>
                <p className="text-xs text-gray-500 capitalize">{member.status}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
