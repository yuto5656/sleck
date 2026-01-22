import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../services/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await authApi.forgotPassword(email)
      setIsSubmitted(true)
    } catch (err) {
      // エラーでも成功メッセージを表示（セキュリティのため）
      setIsSubmitted(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-primary-600 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">Sleck</h1>
            <p className="text-gray-600">メールを確認してください</p>
          </div>

          <div className="text-center space-y-4">
            <div className="p-4 bg-green-50 text-green-700 rounded">
              <p>
                <strong>{email}</strong> にパスワードリセットのリンクを送信しました。
              </p>
              <p className="mt-2 text-sm">
                メールが届かない場合は、迷惑メールフォルダを確認してください。
              </p>
            </div>

            <Link
              to="/login"
              className="inline-block text-primary-600 dark:text-primary-400 hover:underline font-medium"
            >
              ログインページに戻る
            </Link>
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
          <p className="text-gray-600">パスワードをリセット</p>
        </div>

        <p className="text-gray-600 text-sm mb-6">
          登録したメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="name@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-primary-600 dark:bg-gray-900 text-white rounded font-medium hover:bg-primary-600 dark:bg-gray-900-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '送信中...' : 'リセットリンクを送信'}
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
