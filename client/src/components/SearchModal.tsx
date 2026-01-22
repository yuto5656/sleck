import { useState } from 'react'
import { X, Search, Hash, User, FileText, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { searchApi } from '../services/api'

interface SearchModalProps {
  onClose: () => void
}

interface SearchResults {
  messages?: Array<{
    id: string
    content: string
    user: { displayName: string }
    channel: { id: string; name: string }
    createdAt: string
  }>
  files?: Array<{
    id: string
    originalName: string
    mimeType: string
    url: string
  }>
  users?: Array<{
    id: string
    displayName: string
    avatarUrl: string | null
    status: string
  }>
  channels?: Array<{
    id: string
    name: string
    description: string | null
    memberCount: number
  }>
}

export default function SearchModal({ onClose }: SearchModalProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'messages' | 'files' | 'users' | 'channels'>('all')

  const handleSearch = async () => {
    if (!query.trim()) return

    setIsLoading(true)
    try {
      const response = await searchApi.search({
        q: query,
        type: activeTab === 'all' ? undefined : activeTab,
        limit: 20,
      })
      setResults(response.data.results)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleChannelClick = (channelId: string) => {
    navigate(`/channel/${channelId}`)
    onClose()
  }

  const tabs = [
    { id: 'all' as const, label: 'すべて' },
    { id: 'messages' as const, label: 'メッセージ', icon: MessageSquare },
    { id: 'files' as const, label: 'ファイル', icon: FileText },
    { id: 'users' as const, label: 'メンバー', icon: User },
    { id: 'channels' as const, label: 'チャンネル', icon: Hash },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-20 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="メッセージ、ファイルなどを検索"
              className="flex-1 outline-none text-lg text-gray-900 dark:text-white bg-transparent placeholder-gray-400 dark:placeholder-gray-500"
              autoFocus
            />
            <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="flex gap-2 mt-4">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  if (query) handleSearch()
                }}
                className={`flex items-center gap-1 px-3 py-1 text-sm rounded ${
                  activeTab === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tab.icon && <tab.icon className="w-4 h-4" />}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="text-center text-gray-500 dark:text-gray-400">検索中...</div>
          )}

          {!isLoading && results && (
            <div className="space-y-6">
              {/* Messages */}
              {results.messages && results.messages.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">メッセージ</h3>
                  <div className="space-y-2">
                    {results.messages.map((msg) => (
                      <button
                        type="button"
                        key={msg.id}
                        onClick={() => handleChannelClick(msg.channel.id)}
                        className="block w-full text-left p-3 rounded border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                          <Hash className="w-3 h-3" />
                          <span>{msg.channel.name}</span>
                          <span>·</span>
                          <span>{msg.user.displayName}</span>
                        </div>
                        <p className="text-gray-800 dark:text-gray-200 line-clamp-2">{msg.content}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {results.files && results.files.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">ファイル</h3>
                  <div className="space-y-2">
                    {results.files.map((file) => (
                      <a
                        key={file.id}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200">{file.originalName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{file.mimeType}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Users */}
              {results.users && results.users.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">メンバー</h3>
                  <div className="space-y-2">
                    {results.users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 p-3 rounded border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <div className="w-10 h-10 rounded bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.displayName}
                              className="w-full h-full rounded object-cover"
                            />
                          ) : (
                            user.displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200">{user.displayName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Channels */}
              {results.channels && results.channels.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">チャンネル</h3>
                  <div className="space-y-2">
                    {results.channels.map((channel) => (
                      <button
                        type="button"
                        key={channel.id}
                        onClick={() => handleChannelClick(channel.id)}
                        className="flex items-center gap-3 w-full text-left p-3 rounded border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <Hash className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200">{channel.name}</p>
                          {channel.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                              {channel.description}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No results */}
              {results.messages?.length === 0 &&
                results.files?.length === 0 &&
                results.users?.length === 0 &&
                results.channels?.length === 0 && (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    「{query}」に一致する結果がありません
                  </div>
                )}
            </div>
          )}

          {!isLoading && !results && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              <p>メッセージ、ファイル、メンバー、チャンネルを検索</p>
              <p className="text-sm mt-2">
                キーワード、@メンション、#チャンネルで検索してみてください
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
