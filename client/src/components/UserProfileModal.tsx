import { X, MessageSquare } from 'lucide-react'
import { getAvatarUrl } from '../utils/avatarUrl'
import { getStatusColor } from '../utils/statusColors'

interface UserProfile {
  id: string
  displayName: string
  avatarUrl: string | null
  status?: 'online' | 'away' | 'dnd' | 'offline'
  statusMessage?: string | null
  role?: 'admin' | 'deputy_admin' | 'member' | 'owner'
}

interface UserProfileModalProps {
  user: UserProfile
  isOpen: boolean
  onClose: () => void
  onStartDM?: (userId: string) => void
  isCurrentUser?: boolean
}

export default function UserProfileModal({
  user,
  isOpen,
  onClose,
  onStartDM,
  isCurrentUser = false,
}: UserProfileModalProps) {
  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin':
      case 'owner':
        return '管理者'
      case 'deputy_admin':
        return '代理管理者'
      default:
        return 'メンバー'
    }
  }

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'online':
        return 'オンライン'
      case 'away':
        return '離席中'
      case 'dnd':
        return '取り込み中'
      case 'offline':
        return 'オフライン'
      default:
        return ''
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header with avatar */}
        <div className="relative bg-gradient-to-br from-slack-purple to-purple-700 h-24">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Avatar */}
        <div className="relative px-6">
          <div className="absolute -top-12 w-24 h-24 rounded-lg border-4 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-600 overflow-hidden shadow-lg">
            {getAvatarUrl(user.avatarUrl) ? (
              <img
                src={getAvatarUrl(user.avatarUrl)!}
                alt={user.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-500 dark:text-gray-300">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Status indicator */}
            {user.status && (
              <div
                className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(user.status)}`}
              />
            )}
          </div>
        </div>

        {/* User info */}
        <div className="px-6 pt-14 pb-6">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {user.displayName}
            </h2>
            {user.role && (user.role === 'admin' || user.role === 'owner' || user.role === 'deputy_admin') && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                {getRoleLabel(user.role)}
              </span>
            )}
          </div>

          {/* Status */}
          {user.status && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
              <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(user.status)}`} />
              <span>{getStatusLabel(user.status)}</span>
            </div>
          )}

          {/* Status message */}
          {user.statusMessage && (
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 italic">
              "{user.statusMessage}"
            </p>
          )}

          {/* Actions */}
          {!isCurrentUser && onStartDM && (
            <div className="pt-4 border-t dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  onStartDM(user.id)
                  onClose()
                }}
                className="flex items-center gap-2 w-full px-4 py-2 bg-slack-purple hover:bg-slack-purple-dark text-white rounded-lg transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>メッセージを送る</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
