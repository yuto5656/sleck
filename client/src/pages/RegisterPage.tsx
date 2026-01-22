import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-slack-purple dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slack-purple dark:text-primary-400 mb-2">Sleck</h1>
          <p className="text-gray-600 dark:text-gray-400">招待制のワークスペース</p>
        </div>

        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            招待リンクが必要です
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Sleckに参加するには、既存のメンバーからの招待リンクが必要です。
            招待リンクを受け取っている場合は、そのリンクからアクセスしてください。
          </p>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          すでにアカウントをお持ちですか？{' '}
          <Link to="/login" className="text-slack-purple dark:text-primary-400 hover:underline font-medium">
            サインイン
          </Link>
        </div>
      </div>
    </div>
  )
}
