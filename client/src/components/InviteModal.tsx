import { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { workspaceApi } from '../services/api'
import { useWorkspaceStore } from '../stores/workspaceStore'

interface InviteModalProps {
  onClose: () => void
}

export default function InviteModal({ onClose }: InviteModalProps) {
  const { currentWorkspace } = useWorkspaceStore()
  const [inviteUrl, setInviteUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCreateInvite = async () => {
    if (!currentWorkspace) return

    setIsLoading(true)
    setError('')

    try {
      const response = await workspaceApi.createInvite(currentWorkspace.id)
      setInviteUrl(response.data.inviteUrl)
    } catch {
      setError('招待リンクの作成に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('コピーに失敗しました')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">メンバーを招待</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-gray-600">
            招待リンクを作成して、他のユーザーを{currentWorkspace?.name}に招待しましょう。
          </p>

          {error && (
            <div className="bg-red-50 text-red-500 p-3 rounded text-sm">
              {error}
            </div>
          )}

          {!inviteUrl ? (
            <button
              onClick={handleCreateInvite}
              disabled={isLoading}
              className="w-full py-2 bg-slack-purple text-white rounded font-medium hover:bg-slack-purple-dark disabled:opacity-50"
            >
              {isLoading ? '作成中...' : '招待リンクを作成'}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded bg-gray-50 text-sm text-gray-900"
                />
                <button
                  onClick={handleCopy}
                  className="p-2 bg-slack-purple text-white rounded hover:bg-slack-purple-dark"
                >
                  {copied ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                このリンクは7日間有効です
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full py-2 border border-gray-300 rounded font-medium hover:bg-gray-100 text-gray-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
