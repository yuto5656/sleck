import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { workspaceApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'

interface WorkspaceInfo {
  id: string
  name: string
  description?: string
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const fetchInviteInfo = async () => {
      if (!token) return

      try {
        const response = await workspaceApi.getInviteInfo(token)
        setWorkspace(response.data.workspace)
      } catch (err: unknown) {
        const error = err as { response?: { data?: { code?: string } } }
        if (error.response?.data?.code === 'INVITE_EXPIRED') {
          setError('この招待リンクは期限切れです')
        } else if (error.response?.data?.code === 'INVITE_USED') {
          setError('この招待リンクは既に使用されています')
        } else {
          setError('無効な招待リンクです')
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchInviteInfo()
  }, [token])

  const handleAcceptInvite = async () => {
    if (!token) return

    setIsJoining(true)
    setError('')

    try {
      await workspaceApi.acceptInvite(token)
      setSuccess(true)
      setTimeout(() => {
        navigate('/')
      }, 2000)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { code?: string } } }
      if (error.response?.data?.code === 'ALREADY_MEMBER') {
        setError('既にこのワークスペースのメンバーです')
      } else {
        setError('参加に失敗しました')
      }
    } finally {
      setIsJoining(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    )
  }

  if (error && !workspace) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-slack-purple mb-4">Sleck</h1>
          <div className="text-red-500 mb-6">{error}</div>
          <Link to="/login" className="text-slack-purple hover:underline">
            ログインページへ
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-slack-purple mb-4">Sleck</h1>
          <div className="text-green-600 mb-4">
            {workspace?.name} に参加しました！
          </div>
          <div className="text-gray-500">リダイレクト中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-slack-purple text-center mb-6">Sleck</h1>

        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold mb-2">ワークスペースに招待されています</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{workspace?.name}</div>
            {workspace?.description && (
              <div className="text-gray-500 mt-2">{workspace.description}</div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded mb-4 text-center">
            {error}
          </div>
        )}

        {isAuthenticated ? (
          <button
            onClick={handleAcceptInvite}
            disabled={isJoining}
            className="w-full py-3 bg-slack-purple text-white rounded font-medium hover:bg-slack-purple-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isJoining ? '参加中...' : 'ワークスペースに参加'}
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600 text-center">
              参加するにはログインが必要です
            </p>
            <Link
              to={`/login?redirect=/invite/${token}`}
              className="block w-full py-3 bg-slack-purple text-white rounded font-medium hover:bg-slack-purple-dark text-center"
            >
              ログインして参加
            </Link>
            <div className="text-center text-gray-500">
              アカウントをお持ちでないですか？{' '}
              <Link to={`/register?redirect=/invite/${token}`} className="text-slack-purple hover:underline">
                新規登録
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
