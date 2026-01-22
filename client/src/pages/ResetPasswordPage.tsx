import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '../services/api'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }

    if (!token) {
      setError('無効なリセットリンクです')
      return
    }

    setIsLoading(true)

    try {
      await authApi.resetPassword(token, password)
      setIsSuccess(true)
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      setError(error.response?.data?.message || 'パスワードのリセットに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-primary-600 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">Sleck</h1>
            <p className="text-gray-600">エラー</p>
          </div>

          <div className="text-center space-y-4">
            <div className="p-4 bg-red-50 text-red-700 rounded">
              <p>無効なリセットリンクです。</p>
              <p className="mt-2 text-sm">
                リンクの有効期限が切れているか、既に使用されている可能性があります。
              </p>
            </div>

            <Link
              to="/forgot-password"
              className="inline-block text-primary-600 dark:text-primary-400 hover:underline font-medium"
            >
              新しいリセットリンクをリクエスト
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-primary-600 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">Sleck</h1>
            <p className="text-gray-600">パスワードが変更されました</p>
          </div>

          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 text-green-700 rounded">
              <p>パスワードが正常にリセットされました。</p>
              <p className="mt-2 text-sm">
                新しいパスワードでログインしてください。
              </p>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 bg-primary-600 dark:bg-gray-900 text-white rounded font-medium hover:bg-primary-600 dark:bg-gray-900-dark"
            >
              ログインページへ
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary-600 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">Sleck</h1>
          <p className="text-gray-600">新しいパスワードを設定</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              新しいパスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="8文字以上で入力"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              パスワードを確認
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="もう一度入力"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-primary-600 dark:bg-gray-900 text-white rounded font-medium hover:bg-primary-600 dark:bg-gray-900-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '変更中...' : 'パスワードを変更'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <Link to="/login" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
            ログインに戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
