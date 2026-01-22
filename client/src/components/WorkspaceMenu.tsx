import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Plus, X } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'

interface WorkspaceMenuProps {
  onClose: () => void
}

export default function WorkspaceMenu({ onClose }: WorkspaceMenuProps) {
  const navigate = useNavigate()
  const { workspaces, currentWorkspace, setCurrentWorkspace, createWorkspace } = useWorkspaceStore()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleSelectWorkspace = (workspace: typeof workspaces[0]) => {
    setCurrentWorkspace(workspace)
    navigate('/')
    onClose()
  }

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return

    setIsCreating(true)
    setError('')
    try {
      const workspace = await createWorkspace(newWorkspaceName.trim(), newWorkspaceDescription.trim() || undefined)
      setCurrentWorkspace(workspace)
      navigate('/')
      onClose()
    } catch {
      setError('ワークスペースの作成に失敗しました')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div className="absolute top-10 left-4 z-50 w-72 bg-white rounded-lg shadow-lg border overflow-hidden">
        {!showCreateForm ? (
          <>
            <div className="p-3 border-b">
              <p className="text-xs font-medium text-gray-500 uppercase">ワークスペース</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => handleSelectWorkspace(workspace)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-sm">
                    {workspace.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{workspace.name}</p>
                    {workspace.description && (
                      <p className="text-xs text-gray-500 truncate">{workspace.description}</p>
                    )}
                  </div>
                  {currentWorkspace?.id === workspace.id && (
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="p-2 border-t">
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                <Plus className="w-4 h-4" />
                <span>新しいワークスペースを作成</span>
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleCreateWorkspace}>
            <div className="flex items-center justify-between p-3 border-b">
              <p className="font-medium text-gray-900">新しいワークスペース</p>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setNewWorkspaceName('')
                  setNewWorkspaceDescription('')
                  setError('')
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-3 space-y-3">
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ワークスペース名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="例: マイチーム"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明（任意）
                </label>
                <input
                  type="text"
                  value={newWorkspaceDescription}
                  onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="このワークスペースについて"
                />
              </div>
              <button
                type="submit"
                disabled={!newWorkspaceName.trim() || isCreating}
                className="w-full py-2 bg-primary-500 text-white rounded font-medium hover:bg-primary-600 disabled:opacity-50"
              >
                {isCreating ? '作成中...' : '作成'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}
