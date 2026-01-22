import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { workspaceApi } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../components/Toast'

interface WorkspaceInfo {
  id: string
  name: string
  description?: string
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { isAuthenticated, register, login, isLoading, error: authError, clearError } = useAuthStore()
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [pageError, setPageError] = useState('')

  // Registration form
  const [mode, setMode] = useState<'choice' | 'register' | 'login'>('choice')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    const fetchInviteInfo = async () => {
      if (!token) return

      try {
        const response = await workspaceApi.getInviteInfo(token)
        setWorkspace(response.data.workspace)
      } catch (err: unknown) {
        const error = err as { response?: { data?: { code?: string } } }
        if (error.response?.data?.code === 'INVITE_EXPIRED') {
          setPageError('この招待リンクは期限切れです')
        } else if (error.response?.data?.code === 'INVITE_USED') {
          setPageError('この招待リンクは既に使用されています')
        } else {
          setPageError('無効な招待リンクです')
        }
      } finally {
        setIsLoadingPage(false)
      }
    }

    fetchInviteInfo()
  }, [token])

  const handleAcceptInvite = async () => {
    if (!token) return

    setIsJoining(true)
    setPageError('')

    try {
      await workspaceApi.acceptInvite(token)
      toast.success(`${workspace?.name} に参加しました`)
      navigate('/')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { code?: string } } }
      if (error.response?.data?.code === 'ALREADY_MEMBER') {
        setPageError('既にこのワークスペースのメンバーです')
      } else {
        setPageError('参加に失敗しました')
      }
    } finally {
      setIsJoining(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    clearError()
    setValidationError('')

    if (password.length < 8) {
      setValidationError('パスワードは8文字以上で入力してください')
      return
    }

    if (password !== confirmPassword) {
      setValidationError('パスワードが一致しません')
      return
    }

    if (!displayName.trim()) {
      setValidationError('表示名を入力してください')
      return
    }

    try {
      await register(email, password, displayName, token)
      toast.success(`${workspace?.name} に参加しました`)
      navigate('/')
    } catch {
      // Error is handled by the store
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setValidationError('')

    try {
      await login(email, password)
      // After login, accept the invite
      if (token) {
        try {
          await workspaceApi.acceptInvite(token)
          toast.success(`${workspace?.name} に参加しました`)
        } catch (err: unknown) {
          const error = err as { response?: { data?: { code?: string } } }
          if (error.response?.data?.code === 'ALREADY_MEMBER') {
            toast.info('既にこのワークスペースのメンバーです')
          }
        }
      }
      navigate('/')
    } catch {
      // Error is handled by the store
    }
  }

  if (isLoadingPage) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">読み込み中...</div>
      </div>
    )
  }

  if (pageError && !workspace) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-slack-purple dark:text-primary-400 mb-4">Sleck</h1>
          <div className="text-red-500 dark:text-red-400 mb-6">{pageError}</div>
          <Link to="/login" className="text-slack-purple dark:text-primary-400 hover:underline">
            ログインページへ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-slack-purple dark:text-primary-400 text-center mb-6">Sleck</h1>

        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">ワークスペースに招待されています</h2>
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-2xl font-bold text-gray-800 dark:text-white">{workspace?.name}</div>
            {workspace?.description && (
              <div className="text-gray-500 dark:text-gray-400 mt-2">{workspace.description}</div>
            )}
          </div>
        </div>

        {pageError && (
          <div className="bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 p-3 rounded mb-4 text-center">
            {pageError}
          </div>
        )}

        {isAuthenticated ? (
          <button
            onClick={handleAcceptInvite}
            disabled={isJoining}
            className="w-full py-3 bg-slack-purple dark:bg-primary-500 text-white rounded font-medium hover:bg-slack-purple-dark dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isJoining ? '参加中...' : 'ワークスペースに参加'}
          </button>
        ) : mode === 'choice' ? (
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300 text-center">
              参加するにはアカウントが必要です
            </p>
            <button
              onClick={() => setMode('register')}
              className="w-full py-3 bg-slack-purple dark:bg-primary-500 text-white rounded font-medium hover:bg-slack-purple-dark dark:hover:bg-primary-600"
            >
              新規登録して参加
            </button>
            <button
              onClick={() => setMode('login')}
              className="w-full py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded font-medium hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              ログインして参加
            </button>
          </div>
        ) : mode === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-4">
            {(authError || validationError) && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-sm">
                {authError || validationError}
              </div>
            )}

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                表示名
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-3 py-2 border dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-slack-purple dark:focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="あなたの名前"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-slack-purple dark:focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-slack-purple dark:focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="8文字以上"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                パスワード（確認）
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-slack-purple dark:focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="パスワードを再入力"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-slack-purple dark:bg-primary-500 text-white rounded font-medium hover:bg-slack-purple-dark dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'アカウント作成中...' : 'アカウントを作成して参加'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('choice'); clearError(); setValidationError('') }}
              className="w-full py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
            >
              戻る
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            {authError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-sm">
                {authError}
              </div>
            )}

            <div>
              <label htmlFor="loginEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                メールアドレス
              </label>
              <input
                id="loginEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-slack-purple dark:focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label htmlFor="loginPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                パスワード
              </label>
              <input
                id="loginPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-slack-purple dark:focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-slack-purple dark:bg-primary-500 text-white rounded font-medium hover:bg-slack-purple-dark dark:hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'ログイン中...' : 'ログインして参加'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('choice'); clearError() }}
              className="w-full py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm"
            >
              戻る
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
