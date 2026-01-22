import { useState } from 'react'
import { X, Hash, Lock } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'

interface CreateChannelModalProps {
  onClose: () => void
}

export default function CreateChannelModal({ onClose }: CreateChannelModalProps) {
  const { currentWorkspace, createChannel } = useWorkspaceStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentWorkspace) {
      setError('ワークスペースを先に選択してください')
      return
    }

    // Validate name - allow Japanese characters, alphanumeric, and hyphens
    const trimmedName = name.trim()
    if (!trimmedName || trimmedName.length > 80) {
      setError('チャンネル名を1〜80文字で入力してください')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await createChannel(currentWorkspace.id, trimmedName, description || undefined, isPrivate)
      onClose()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } }
      setError(error.response?.data?.error?.message || 'チャンネルの作成に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">チャンネルを作成</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              名前
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                {isPrivate ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 企画、general"
                className="w-full pl-10 pr-3 py-2 border dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
                autoFocus
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              日本語、英数字、ハイフンが使用可能
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              説明 <span className="text-gray-400 dark:text-gray-500">（任意）</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このチャンネルの目的は？"
              className="w-full px-3 py-2 border dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="private"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="private" className="text-sm text-gray-900 dark:text-white">
              <span className="font-medium">プライベートにする</span>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                招待されたメンバーのみがこのチャンネルを見ることができます
              </p>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '作成中...' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
