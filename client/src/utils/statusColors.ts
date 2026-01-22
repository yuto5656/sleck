/**
 * ユーザーステータスに応じた色クラスを返す
 */
export function getStatusColor(status: string, format: 'bg' | 'text' = 'bg'): string {
  const colors: Record<string, { bg: string; text: string }> = {
    online: { bg: 'bg-green-500', text: 'text-green-500' },
    away: { bg: 'bg-yellow-500', text: 'text-yellow-500' },
    dnd: { bg: 'bg-red-500', text: 'text-red-500' },
    offline: { bg: 'bg-gray-400', text: 'text-gray-400' },
  }
  return colors[status]?.[format] || colors.offline[format]
}
