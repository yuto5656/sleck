import { useState, useEffect } from 'react'
import { X, UserPlus, Search, Shield, ShieldCheck } from 'lucide-react'
import { channelApi, workspaceApi } from '../services/api'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { getStatusColor } from '../utils/statusColors'
import { getErrorMessage } from '../utils/errorUtils'
import { getAvatarUrl } from '../utils/avatarUrl'
import { useToast } from './Toast'
import { UserRole } from '../types'

export interface ChannelMember {
  id: string
  displayName: string
  avatarUrl: string | null
  status: string
  role: UserRole
  joinedAt: string
}

interface WorkspaceMember {
  id: string
  displayName: string
  avatarUrl: string | null
  status: string
}

interface MembersPanelProps {
  channelId: string
  onClose: () => void
  initialShowInvite?: boolean
}

export default function MembersPanel({ channelId, onClose, initialShowInvite = false }: MembersPanelProps) {
  const { currentWorkspace, currentChannel } = useWorkspaceStore()
  const toast = useToast()
  const [members, setMembers] = useState<ChannelMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(initialShowInvite)
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingWorkspaceMembers, setIsLoadingWorkspaceMembers] = useState(false)
  const [addingUserId, setAddingUserId] = useState<string | null>(null)

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

  const loadWorkspaceMembers = async () => {
    if (!currentWorkspace) return
    setIsLoadingWorkspaceMembers(true)
    try {
      const response = await workspaceApi.getMembers(currentWorkspace.id, { limit: 100 })
      setWorkspaceMembers(response.data.members)
    } catch (err) {
      toast.error(getErrorMessage(err, 'ワークスペースメンバーの読み込みに失敗しました'))
    } finally {
      setIsLoadingWorkspaceMembers(false)
    }
  }

  useEffect(() => {
    loadMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId])

  useEffect(() => {
    if (showInvite && workspaceMembers.length === 0) {
      loadWorkspaceMembers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInvite])

  const handleAddMember = async (userId: string) => {
    setAddingUserId(userId)
    try {
      await channelApi.addMember(channelId, userId)
      toast.success('メンバーを追加しました')
      // Refresh member list
      await loadMembers()
    } catch (err) {
      toast.error(getErrorMessage(err, 'メンバーの追加に失敗しました'))
    } finally {
      setAddingUserId(null)
    }
  }

  // Filter workspace members who are not already channel members
  const availableMembers = workspaceMembers.filter(
    (wm) => !members.some((m) => m.id === wm.id)
  )

  const filteredMembers = availableMembers.filter((m) =>
    m.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isPrivateChannel = currentChannel?.isPrivate

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 border-l dark:border-gray-700 shadow-lg z-40 flex flex-col">
      <div className="h-14 border-b dark:border-gray-700 flex items-center justify-between px-4">
        <h2 className="font-bold text-gray-900 dark:text-white">
          {showInvite ? 'メンバーを招待' : 'メンバー'}
        </h2>
        <div className="flex items-center gap-2">
          {isPrivateChannel && !showInvite && (
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-blue-600 dark:text-blue-400"
              title="メンバーを招待"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (showInvite) {
                setShowInvite(false)
                setSearchQuery('')
              } else {
                onClose()
              }
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {showInvite ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ユーザーを検索..."
              className="w-full pl-9 pr-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isLoadingWorkspaceMembers ? (
            <div className="text-center text-gray-500 dark:text-gray-400">読み込み中...</div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400">
              {searchQuery ? '該当するユーザーが見つかりません' : '招待できるユーザーがいません'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200">
                        {getAvatarUrl(member.avatarUrl) ? (
                          <img
                            src={getAvatarUrl(member.avatarUrl)!}
                            alt={member.displayName}
                            className="w-full h-full rounded object-cover"
                          />
                        ) : (
                          member.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(member.status)}`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{member.displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{member.status}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddMember(member.id)}
                    disabled={addingUserId === member.id}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50"
                    title="招待"
                  >
                    {addingUserId === member.id ? (
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <UserPlus className="w-5 h-5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center text-gray-500 dark:text-gray-400">読み込み中...</div>
          ) : error ? (
            <div className="text-center">
              <p className="text-red-500 dark:text-red-400 mb-2">{error}</p>
              <button
                type="button"
                onClick={loadMembers}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
              >
                再試行
              </button>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400">メンバーがいません</div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200">
                        {getAvatarUrl(member.avatarUrl) ? (
                          <img
                            src={getAvatarUrl(member.avatarUrl)!}
                            alt={member.displayName}
                            className="w-full h-full rounded object-cover"
                          />
                        ) : (
                          member.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(member.status)}`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{member.displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{member.status}</p>
                    </div>
                  </div>
                  {member.role === 'admin' && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30" title="管理者">
                      <Shield className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">管理者</span>
                    </div>
                  )}
                  {member.role === 'deputy_admin' && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30" title="代理管理者">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">代理管理者</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
