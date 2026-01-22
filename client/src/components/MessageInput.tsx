import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Paperclip, Smile, AtSign, X } from 'lucide-react'
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
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const filteredMembers: MentionMember[] = showMentionList
    ? members.filter((m) =>
        m.displayName.toLowerCase().includes(mentionSearch.toLowerCase())
      ).slice(0, 5)
    : []

  useEffect(() => {
    setMentionIndex(0)
  }, [mentionSearch])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles].slice(0, 10))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    maxSize: 50 * 1024 * 1024,
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

    const contentToSend = trimmedContent
    const filesToSend = [...files]
    setContent('')
    setFiles([])

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    if (isTyping) {
      socketService.stopTyping({ channelId, dmId })
      setIsTyping(false)
    }

    setIsSending(true)
    try {
      if (filesToSend.length > 0) {
        await fileApi.uploadMultiple(filesToSend)
      }
      await onSend(contentToSend, filesToSend)
    } catch (error) {
      console.error('Failed to send message:', error)
      setContent(contentToSend)
      setFiles(filesToSend)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
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

    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`

    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = value.slice(0, cursorPos)
    // Match @ followed by any non-space characters (supports Japanese, alphanumeric, etc.)
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/)

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

    // Match @ followed by any non-space characters
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/)
    if (mentionMatch) {
      const beforeMention = textBeforeCursor.slice(0, mentionMatch.index)
      // Use display name without spaces for mention, or wrap in angle brackets if contains spaces
      const mentionName = member.displayName.includes(' ')
        ? `<${member.displayName}>`
        : member.displayName

      // Check if the text after cursor starts with remaining part of the search
      // This prevents duplication when user typed partial name
      let cleanTextAfter = textAfterCursor
      const partialSearch = mentionMatch[1] // What user typed after @
      if (partialSearch && textAfterCursor.toLowerCase().startsWith(partialSearch.toLowerCase())) {
        // This shouldn't happen normally, but handle edge case
        cleanTextAfter = textAfterCursor.slice(partialSearch.length)
      }

      const newContent = `${beforeMention}@${mentionName} ${cleanTextAfter}`
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
        <div className="absolute inset-0 bg-primary-50 dark:bg-primary-900 border-2 border-dashed border-primary-400 rounded-2xl flex items-center justify-center z-10 animate-fade-in">
          <p className="text-primary-600 dark:text-primary-300 font-medium">ファイルをここにドロップ</p>
        </div>
      )}

      {/* File previews */}
      {files.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="relative group bg-surface-100 dark:bg-gray-700 rounded-xl p-3 pr-8 border border-surface-200 dark:border-gray-600 animate-slide-up"
            >
              <span className="text-sm text-gray-700 dark:text-gray-200 truncate max-w-xs block font-medium">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute top-2 right-2 w-5 h-5 bg-gray-300 dark:bg-gray-500 rounded-full text-xs hover:bg-red-400 hover:text-white transition-colors flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={clsx(
        'flex items-center gap-2 bg-surface-50 dark:bg-gray-800 border border-surface-200 dark:border-gray-600 rounded-2xl p-2 transition-all duration-200',
        isDragActive && 'border-primary-400 bg-primary-50 dark:bg-primary-900',
        'focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20'
      )}>
        <input {...getInputProps()} />

        <button
          type="button"
          onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
          className="p-2.5 hover:bg-surface-200 dark:hover:bg-gray-700 rounded-xl flex-shrink-0 transition-colors"
          title="ファイルを添付"
        >
          <Paperclip className="w-5 h-5 text-gray-400" />
        </button>

        <textarea
          ref={inputRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 resize-none outline-none max-h-32 py-2 leading-normal bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
          rows={1}
          disabled={isSending}
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2.5 hover:bg-surface-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
            title="絵文字"
          >
            <Smile className="w-5 h-5 text-gray-400" />
          </button>

          <button
            type="button"
            onClick={handleMentionButtonClick}
            className="p-2.5 hover:bg-surface-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
            title="メンション"
          >
            <AtSign className="w-5 h-5 text-gray-400" />
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || (!content.trim() && files.length === 0)}
            className={clsx(
              'p-2.5 rounded-xl transition-all duration-200',
              content.trim() || files.length > 0
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:shadow-glow hover:-translate-y-0.5'
                : 'bg-surface-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            )}
            title="送信"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showEmojiPicker && (
        <div className="absolute bottom-full right-4 mb-2 z-50 animate-slide-up">
          <EmojiPicker onEmojiClick={handleEmojiSelect} />
        </div>
      )}

      {/* Mention list */}
      {showMentionList && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-4 mb-2 bg-white dark:bg-gray-800 border border-surface-200 dark:border-gray-600 rounded-2xl shadow-soft z-50 w-72 max-h-52 overflow-y-auto animate-slide-up">
          {filteredMembers.map((member, index) => (
            <button
              type="button"
              key={member.id}
              onClick={() => handleMentionSelect(member)}
              className={clsx(
                'w-full flex items-center gap-3 p-3 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl',
                index === mentionIndex ? 'bg-primary-50 dark:bg-primary-900' : 'hover:bg-surface-50 dark:hover:bg-gray-700'
              )}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.displayName}
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  member.displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{member.displayName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{member.status}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
