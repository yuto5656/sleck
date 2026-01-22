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
    // Use VITE_SOCKET_URL as the server base URL (more reliable than parsing API URL)
    const serverUrl = import.meta.env.VITE_SOCKET_URL || ''
    return serverUrl ? `${serverUrl}${avatarUrl}` : avatarUrl
  }

  return avatarUrl
}
