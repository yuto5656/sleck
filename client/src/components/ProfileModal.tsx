import { useState } from 'react'
import { X, Camera } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { userApi } from '../services/api'
import { useToast } from './Toast'
import { getErrorMessage } from '../utils/errorUtils'

interface ProfileModalProps {
  onClose: () => void
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, setUser } = useAuthStore()
  const toast = useToast()
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return

    setIsLoading(true)
    try {
      const response = await userApi.updateProfile({ displayName: displayName.trim() })
      setUser(response.data)
      toast.success('プロフィールを更新しました')
      onClose()
    } catch (error) {
      toast.error(getErrorMessage(error, 'プロフィールの更新に失敗しました'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">プロフィール編集</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-3xl font-bold text-white">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-full h-full rounded-2xl object-cover"
                  />
                ) : (
                  user?.displayName?.charAt(0).toUpperCase() || '?'
                )}
              </div>
              <button
                type="button"
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white hover:bg-primary-600 transition-colors shadow-lg"
                title="アバターを変更（準備中）"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              表示名
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="表示名を入力"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">メールアドレスは変更できません</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isLoading || !displayName.trim()}
              className="flex-1 py-2 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
