import { useState } from 'react'
import { Hash, Lock, X, Trash2 } from 'lucide-react'
import { Channel } from '../types'
import { useConfirmDialog } from './ConfirmDialog'
import { useToast } from './Toast'
import { getErrorMessage } from '../utils/errorUtils'

interface ChannelSettingsPanelProps {
  channel: Channel
  onClose: () => void
  onDelete: () => Promise<void>
}

export default function ChannelSettingsPanel({ channel, onClose, onDelete }: ChannelSettingsPanelProps) {
  const { showConfirm } = useConfirmDialog()
  const toast = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

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
    <div className="fixed top-0 right-0 h-full w-80 bg-white border-l shadow-lg z-40 flex flex-col">
      <div className="h-14 border-b flex items-center justify-between px-4">
        <h2 className="font-bold">チャンネル設定</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              チャンネル名
            </label>
            <p className="text-gray-900">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                説明
              </label>
              <p className="text-gray-900">{channel.description}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイプ
            </label>
            <p className="text-gray-900">
              {channel.isPrivate ? 'プライベート' : 'パブリック'}
            </p>
          </div>

          {/* Delete Channel */}
          <div className="pt-4 border-t mt-6">
            <label className="block text-sm font-medium text-red-600 mb-2">
              危険な操作
            </label>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? '削除中...' : 'チャンネルを削除'}
            </button>
            <p className="mt-2 text-xs text-gray-500">
              チャンネルを削除すると、すべてのメッセージも削除されます。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
