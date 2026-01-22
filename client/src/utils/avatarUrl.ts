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

  // Get API base URL from environment
  const apiUrl = import.meta.env.VITE_API_URL || ''

  // If relative URL starting with /uploads, prepend API server URL
  if (avatarUrl.startsWith('/uploads')) {
    // Extract the base server URL (remove /api/v1 if present)
    const serverUrl = apiUrl.replace(/\/api\/v1$/, '')
    return serverUrl ? `${serverUrl}${avatarUrl}` : avatarUrl
  }

  return avatarUrl
}
