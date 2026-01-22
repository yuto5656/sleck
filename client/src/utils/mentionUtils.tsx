import clsx from 'clsx'

// Convert text with newlines to React nodes with <br /> elements
function formatNewlines(text: string, keyPrefix: string): React.ReactNode[] {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []

  lines.forEach((line, index) => {
    if (index > 0) {
      result.push(<br key={`${keyPrefix}-br-${index}`} />)
    }
    if (line) {
      result.push(line)
    }
  })

  return result
}

/**
 * Format message content with mention highlighting
 * Only highlights mentions that match valid user names
 * Supports both @name and @<name with spaces> formats
 *
 * @param content - The message content to format
 * @param validUserNames - Array of valid user display names (case-insensitive matching)
 * @param currentUserName - Current user's display name for self-mention highlighting
 */
export function formatMentions(
  content: string,
  validUserNames: string[],
  currentUserName?: string
): React.ReactNode[] {
  // Match @<name with spaces> or @name (no spaces)
  const mentionRegex = /@(?:<([^>]+)>|(\S+))/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match
  let partIndex = 0

  // Create lowercase set for efficient lookup
  const validNamesLower = new Set(validUserNames.map(name => name.toLowerCase()))

  while ((match = mentionRegex.exec(content)) !== null) {
    // match[1] is name in brackets, match[2] is name without brackets
    const mentionName = match[1] || match[2]

    // Check if this mention matches a valid user
    const isValidMention = validNamesLower.has(mentionName.toLowerCase())

    // Add text before mention (with newline handling)
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index)
      parts.push(...formatNewlines(textBefore, `text-${partIndex++}`))
    }

    if (isValidMention) {
      // Valid mention - highlight it
      const displayText = match[1] ? match[1] : match[2]
      const isSelfMention = currentUserName && mentionName.toLowerCase() === currentUserName.toLowerCase()

      parts.push(
        <span
          key={`mention-${match.index}`}
          className={clsx(
            'px-1 rounded font-medium',
            isSelfMention
              ? 'bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-200'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
          )}
        >
          @{displayText}さん
        </span>
      )
    } else {
      // Invalid mention - render as plain text
      parts.push(match[0])
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text (with newline handling)
  if (lastIndex < content.length) {
    const textAfter = content.slice(lastIndex)
    parts.push(...formatNewlines(textAfter, `text-${partIndex}`))
  }

  return parts.length > 0 ? parts : formatNewlines(content, 'text-0')
}
