import { format, isToday, isYesterday } from 'date-fns'
import { ja } from 'date-fns/locale'

/**
 * 日付区切り線用のフォーマット
 */
export function formatDateDivider(date: string): string {
  const d = new Date(date)
  if (isToday(d)) return '今日'
  if (isYesterday(d)) return '昨日'
  return format(d, 'yyyy年M月d日', { locale: ja })
}

/**
 * 日付区切り線を表示すべきか判定
 */
export function shouldShowDateDivider(
  currentDate: string,
  previousDate?: string
): boolean {
  if (!previousDate) return true
  return new Date(currentDate).toDateString() !== new Date(previousDate).toDateString()
}

/**
 * メッセージヘッダーを表示すべきか判定
 * - 前のメッセージと送信者が異なる場合
 * - 5分以上間隔がある場合
 */
export function shouldShowMessageHeader(
  currentUserId: string,
  currentTime: number,
  previousUserId?: string,
  previousTime?: number
): boolean {
  if (!previousUserId || !previousTime) return true
  if (previousUserId !== currentUserId) return true
  return currentTime - previousTime > 5 * 60 * 1000
}
