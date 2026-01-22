/**
 * Convert relative avatar URL to full URL
 * Handles both relative paths from server and external URLs
 */
export function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null

  // If already a full URL, return as-is
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl
  }

  // If relative URL starting with /uploads, prepend server URL
  if (avatarUrl.startsWith('/uploads')) {
    // Try VITE_SOCKET_URL first, then extract from VITE_API_URL
    let serverUrl = import.meta.env.VITE_SOCKET_URL || ''

    if (!serverUrl) {
      // Extract base URL from API URL (remove /api/v1)
      const apiUrl = import.meta.env.VITE_API_URL || ''
      serverUrl = apiUrl.replace(/\/api\/v1\/?$/, '')
    }

    return serverUrl ? `${serverUrl}${avatarUrl}` : avatarUrl
  }

  return avatarUrl
}
