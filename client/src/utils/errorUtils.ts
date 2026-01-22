/**
 * APIエラーの型定義
 */
export interface ApiError {
  response?: {
    data?: {
      error?: { message?: string }
      code?: string
    }
  }
}

/**
 * エラーからメッセージを抽出
 */
export function getErrorMessage(error: unknown, defaultMessage: string): string {
  const err = error as ApiError
  return err.response?.data?.error?.message || defaultMessage
}

/**
 * エラーコードを取得
 */
export function getErrorCode(error: unknown): string | undefined {
  const err = error as ApiError
  return err.response?.data?.code
}
