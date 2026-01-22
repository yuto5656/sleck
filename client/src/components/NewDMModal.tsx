import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Search } from 'lucide-react'
import clsx from 'clsx'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useDMStore } from '../stores/dmStore'
import { useAuthStore } from '../stores/authStore'
import { getStatusColor } from '../utils/statusColors'

interface NewDMModalProps {
  onClose: () => void
}

export default function NewDMModal({ onClose }: NewDMModalProps) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { members } = useWorkspaceStore()
  const { createDM, setCurrentDM } = useDMStore()
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  // Filter members (exclude self)
  const filteredMembers = members.filter(
    (member) =>
      member.id !== user?.id &&
      member.displayName.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelectMember = async (memberId: string) => {
    setIsCreating(true)
    setError('')
    try {
      const dm = await createDM(memberId)
      setCurrentDM(dm)
      navigate(`/dm/${dm.id}`)
      onClose()
    } catch {
      setError('ダイレクトメッセージの作成に失敗しました')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">新しいメッセージ</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4">
          {error && (
            <p className="mb-3 text-sm text-red-600">{error}</p>
          )}

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="メンバーを検索..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slack-purple"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                {search ? 'メンバーが見つかりません' : 'メンバーがいません'}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleSelectMember(member.id)}
                    disabled={isCreating}
                    className={clsx(
                      'w-full flex items-center gap-3 p-2 rounded hover:bg-gray-100 text-left',
                      isCreating && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded bg-gray-300 flex items-center justify-center text-sm font-medium">
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
                      <div
                        className={clsx(
                          'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white',
                          getStatusColor(member.status)
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {member.displayName}
                      </p>
                      {member.statusMessage && (
                        <p className="text-xs text-gray-500 truncate">
                          {member.statusMessage}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
