import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Copy, Check, Loader2 } from 'lucide-react'
import { workspaceApi } from '../services/api'
import { useWorkspaceStore } from '../stores/workspaceStore'

interface InviteModalProps {
  onClose: () => void
}

export default function InviteModal({ onClose }: InviteModalProps) {
  const { currentWorkspace } = useWorkspaceStore()
  const [inviteUrl, setInviteUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const createInvite = async () => {
      if (!currentWorkspace) return

      try {
        const response = await workspaceApi.createInvite(currentWorkspace.id)
        setInviteUrl(response.data.inviteUrl)
      } catch {
        setError('招待リンクの作成に失敗しました')
      } finally {
        setIsLoading(false)
      }
    }

    createInvite()
  }, [currentWorkspace])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('コピーに失敗しました')
    }
  }

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">メンバーを招待</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            招待リンクを作成して、他のユーザーを{currentWorkspace?.name}に招待しましょう。
          </p>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 p-3 rounded text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : inviteUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleCopy}
                  className="p-2 bg-primary-500 text-white rounded hover:bg-primary-600"
                >
                  {copied ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                このリンクは7日間有効です
              </p>
            </div>
          ) : null}
        </div>

        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded font-medium hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
