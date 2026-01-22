import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'

export default function WorkspacePage() {
  const navigate = useNavigate()
  const { workspaces, currentWorkspace, setCurrentWorkspace, createWorkspace, currentChannel } = useWorkspaceStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // If there's a current channel, redirect to it
  useEffect(() => {
    if (currentChannel) {
      navigate(`/channel/${currentChannel.id}`, { replace: true })
    }
  }, [currentChannel, navigate])

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return

    setIsCreating(true)
    try {
      const workspace = await createWorkspace(newWorkspaceName)
      setCurrentWorkspace(workspace)
      setShowCreateModal(false)
      setNewWorkspaceName('')
    } catch {
      // Error handled by store
    } finally {
      setIsCreating(false)
    }
  }

  const handleSelectWorkspace = (workspace: typeof workspaces[0]) => {
    setCurrentWorkspace(workspace)
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8">
        {workspaces.length === 0 ? (
          <div className="text-center">
            <div className="w-20 h-20 bg-primary-500 rounded-lg mx-auto mb-6 flex items-center justify-center">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Sleckへようこそ！
            </h2>
            <p className="text-gray-600 mb-6">
              最初のワークスペースを作成して始めましょう
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-500-dark"
            >
              ワークスペースを作成
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              ワークスペースを選択
            </h2>
            <div className="space-y-3">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleSelectWorkspace(workspace)}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-colors ${
                    currentWorkspace?.id === workspace.id
                      ? 'border-primary-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-12 h-12 bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                    {workspace.iconUrl ? (
                      <img
                        src={workspace.iconUrl}
                        alt={workspace.name}
                        className="w-full h-full rounded-lg object-cover"
                      />
                    ) : (
                      workspace.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-900">{workspace.name}</p>
                    <p className="text-sm text-gray-500 capitalize">{workspace.role}</p>
                  </div>
                </button>
              ))}

              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors"
              >
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Plus className="w-6 h-6 text-gray-500" />
                </div>
                <span className="font-medium text-gray-600">新しいワークスペースを作成</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create workspace modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">ワークスペースを作成</h3>
            <form onSubmit={handleCreateWorkspace}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ワークスペース名
                </label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="例: 開発チーム"
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newWorkspaceName.trim()}
                  className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-500-dark disabled:opacity-50"
                >
                  {isCreating ? '作成中...' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
