import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Shield, ShieldCheck, User as UserIcon, Trash2, KeyRound } from 'lucide-react'
import { userApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { getStatusColor } from '../utils/statusColors'
import { getErrorMessage } from '../utils/errorUtils'
import { getAvatarUrl } from '../utils/avatarUrl'
import { useToast } from './Toast'
import { useConfirmDialog } from './ConfirmDialog'
import { UserRole } from '../types'

interface UserData {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  status: string
  role: UserRole
  createdAt: string
}

interface UserManagementPanelProps {
  onClose: () => void
}

const roleLabels: Record<UserRole, string> = {
  admin: '管理者',
  deputy_admin: '代理管理者',
  member: '一般',
}

const roleIcons: Record<UserRole, React.ReactNode> = {
  admin: <Shield className="w-4 h-4 text-yellow-500" />,
  deputy_admin: <ShieldCheck className="w-4 h-4 text-blue-500" />,
  member: <UserIcon className="w-4 h-4 text-gray-500" />,
}

export default function UserManagementPanel({ onClose }: UserManagementPanelProps) {
  const { user: currentUser } = useAuthStore()
  const toast = useToast()
  const { showConfirm } = useConfirmDialog()
  const [users, setUsers] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<UserData | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  const loadUsers = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await userApi.getAllUsers()
      setUsers(response.data.users)
    } catch (err) {
      setError(getErrorMessage(err, 'ユーザー一覧の取得に失敗しました'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleRoleChange = async (userId: string, newRole: 'deputy_admin' | 'member') => {
    setUpdatingUserId(userId)
    try {
      await userApi.updateRole(userId, newRole)
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
      toast.success('ロールを変更しました')
    } catch (err) {
      toast.error(getErrorMessage(err, 'ロールの変更に失敗しました'))
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleResetPassword = async () => {
    if (!resetPasswordUser || newPassword.length < 8) return

    setIsResettingPassword(true)
    try {
      await userApi.resetPassword(resetPasswordUser.id, newPassword)
      toast.success(`${resetPasswordUser.displayName}のパスワードをリセットしました`)
      setResetPasswordUser(null)
      setNewPassword('')
    } catch (err) {
      toast.error(getErrorMessage(err, 'パスワードのリセットに失敗しました'))
    } finally {
      setIsResettingPassword(false)
    }
  }

  const handleDeleteUser = async (user: UserData) => {
    const confirmed = await showConfirm({
      title: 'ユーザーを削除',
      message: `「${user.displayName}」を削除しますか？このユーザーのメッセージやデータも全て削除されます。この操作は取り消せません。`,
      confirmText: '削除',
      cancelText: 'キャンセル',
      danger: true,
    })

    if (!confirmed) return

    setDeletingUserId(user.id)
    try {
      await userApi.deleteUser(user.id)
      setUsers(users.filter(u => u.id !== user.id))
      toast.success('ユーザーを削除しました')
    } catch (err) {
      toast.error(getErrorMessage(err, 'ユーザーの削除に失敗しました'))
    } finally {
      setDeletingUserId(null)
    }
  }

  // Only admin can access this panel
  if (currentUser?.role !== 'admin') {
    return null
  }

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        <div className="h-14 border-b dark:border-gray-700 flex items-center justify-between px-6">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">ユーザー管理</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center text-gray-500 dark:text-gray-400">読み込み中...</div>
          ) : error ? (
            <div className="text-center">
              <p className="text-red-500 dark:text-red-400 mb-2">{error}</p>
              <button
                type="button"
                onClick={loadUsers}
                className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
              >
                再試行
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-200">
                        {getAvatarUrl(user.avatarUrl) ? (
                          <img
                            src={getAvatarUrl(user.avatarUrl)!}
                            alt={user.displayName}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          user.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(user.status)}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white">{user.displayName}</p>
                        {roleIcons[user.role]}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {user.role === 'admin' ? (
                      <span className="px-3 py-1 text-sm font-medium text-yellow-700 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200 rounded-lg">
                        {roleLabels[user.role]}
                      </span>
                    ) : (
                      <>
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as 'deputy_admin' | 'member')}
                          disabled={updatingUserId === user.id || deletingUserId === user.id}
                          className="px-3 py-1 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                        >
                          <option value="deputy_admin">代理管理者</option>
                          <option value="member">一般</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setResetPasswordUser(user)}
                          disabled={deletingUserId === user.id}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50 transition-colors"
                          title="パスワードをリセット"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          disabled={deletingUserId === user.id}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg disabled:opacity-50 transition-colors"
                          title="ユーザーを削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t dark:border-gray-700">
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4 text-yellow-500" />
              <span>管理者: 全権限</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span>代理管理者: チャンネル作成・削除</span>
            </div>
            <div className="flex items-center gap-1">
              <UserIcon className="w-4 h-4 text-gray-500" />
              <span>一般: 閲覧・投稿のみ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const passwordResetModal = resetPasswordUser && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          パスワードリセット
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          「{resetPasswordUser.displayName}」の新しいパスワードを入力してください
        </p>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="新しいパスワード（8文字以上）"
          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
          minLength={8}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { setResetPasswordUser(null); setNewPassword('') }}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={newPassword.length < 8 || isResettingPassword}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResettingPassword ? 'リセット中...' : 'リセット'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {createPortal(modalContent, document.body)}
      {resetPasswordUser && createPortal(passwordResetModal, document.body)}
    </>
  )
}
