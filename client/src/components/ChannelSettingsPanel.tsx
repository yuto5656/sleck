import { useState } from 'react'
import { Hash, Lock, X, Trash2 } from 'lucide-react'
import { Channel } from '../types'
import { useAuthStore } from '../stores/authStore'
import { useConfirmDialog } from './ConfirmDialog'
import { useToast } from './Toast'
import { getErrorMessage } from '../utils/errorUtils'

interface ChannelSettingsPanelProps {
  channel: Channel
  onClose: () => void
  onDelete: () => Promise<void>
}

export default function ChannelSettingsPanel({ channel, onClose, onDelete }: ChannelSettingsPanelProps) {
  const { user } = useAuthStore()
  const { showConfirm } = useConfirmDialog()
  const toast = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const isGeneralChannel = channel.name.toLowerCase() === 'general'
  const canDelete = (user?.role === 'admin' || user?.role === 'deputy_admin') && !isGeneralChannel

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: 'チャンネルを削除',
      message: `チャンネル「${channel.name}」を削除しますか？この操作は取り消せません。すべてのメッセージも削除されます。`,
      confirmText: '削除',
      cancelText: 'キャンセル',
      danger: true,
    })

    if (!confirmed) return

    setIsDeleting(true)
    try {
      await onDelete()
      toast.success('チャンネルを削除しました')
    } catch (error) {
      toast.error(getErrorMessage(error, 'チャンネルの削除に失敗しました'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 border-l dark:border-gray-700 shadow-lg z-40 flex flex-col">
      <div className="h-14 border-b dark:border-gray-700 flex items-center justify-between px-4">
        <h2 className="font-bold text-gray-900 dark:text-white">チャンネル設定</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              チャンネル名
            </label>
            <p className="text-gray-900 dark:text-white">
              {channel.isPrivate ? (
                <Lock className="w-4 h-4 inline mr-1" />
              ) : (
                <Hash className="w-4 h-4 inline mr-1" />
              )}
              {channel.name}
            </p>
          </div>
          {channel.description && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                説明
              </label>
              <p className="text-gray-900 dark:text-white">{channel.description}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              タイプ
            </label>
            <p className="text-gray-900 dark:text-white">
              {channel.isPrivate ? 'プライベート' : 'パブリック'}
            </p>
          </div>

          {/* Delete Channel */}
          {canDelete && (
            <div className="pt-4 border-t dark:border-gray-700 mt-6">
              <label className="block text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                危険な操作
              </label>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? '削除中...' : 'チャンネルを削除'}
              </button>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                チャンネルを削除すると、すべてのメッセージも削除されます。
              </p>
            </div>
          )}
          {isGeneralChannel && (
            <div className="pt-4 border-t dark:border-gray-700 mt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Generalチャンネルは削除できません。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
