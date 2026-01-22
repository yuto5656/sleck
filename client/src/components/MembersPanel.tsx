import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { channelApi } from '../services/api'
import { getStatusColor } from '../utils/statusColors'
import { getErrorMessage } from '../utils/errorUtils'

export interface ChannelMember {
  id: string
  displayName: string
  avatarUrl: string | null
  status: string
  joinedAt: string
}

interface MembersPanelProps {
  channelId: string
  onClose: () => void
}

export default function MembersPanel({ channelId, onClose }: MembersPanelProps) {
  const [members, setMembers] = useState<ChannelMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMembers = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await channelApi.getMembers(channelId)
      setMembers(response.data.members)
    } catch (err) {
      setError(getErrorMessage(err, 'メンバーの読み込みに失敗しました'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-white border-l shadow-lg z-40 flex flex-col">
      <div className="h-14 border-b flex items-center justify-between px-4">
        <h2 className="font-bold">メンバー</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center text-gray-500">読み込み中...</div>
        ) : error ? (
          <div className="text-center">
            <p className="text-red-500 mb-2">{error}</p>
            <button
              type="button"
              onClick={loadMembers}
              className="text-blue-600 hover:underline text-sm"
            >
              再試行
            </button>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center text-gray-500">メンバーがいません</div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
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
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(member.status)}`}
                  />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{member.displayName}</p>
                  <p className="text-xs text-gray-500 capitalize">{member.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
