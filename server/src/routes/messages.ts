import { Router, Response, NextFunction } from 'express'
import { body, query, validationResult } from 'express-validator'
import { prisma, io } from '../index'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Get messages for a channel
router.get(
  '/channels/:channelId/messages',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('before').optional().isUUID(),
    query('after').optional().isUUID(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { limit = '50', before, after } = req.query

      // Check channel access
      const channel = await prisma.channel.findUnique({
        where: { id: req.params.channelId },
      })

      if (!channel) {
        throw new AppError('Channel not found', 404, 'NOT_FOUND')
      }

      if (channel.isPrivate) {
        const membership = await prisma.channelMember.findUnique({
          where: {
            userId_channelId: {
              userId: req.userId!,
              channelId: channel.id,
            },
          },
        })

        if (!membership) {
          throw new AppError('Access denied', 403, 'FORBIDDEN')
        }
      }

      let cursor = undefined
      if (before) {
        const beforeMsg = await prisma.message.findUnique({ where: { id: before as string } })
        if (beforeMsg) {
          cursor = { createdAt: { lt: beforeMsg.createdAt } }
        }
      } else if (after) {
        const afterMsg = await prisma.message.findUnique({ where: { id: after as string } })
        if (afterMsg) {
          cursor = { createdAt: { gt: afterMsg.createdAt } }
        }
      }

      const messages = await prisma.message.findMany({
        where: {
          channelId: req.params.channelId,
          parentId: null, // Only top-level messages
          ...cursor,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          reactions: {
            include: {
              user: {
                select: { id: true },
              },
            },
          },
          files: true,
          _count: {
            select: { replies: true },
          },
          replies: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          },
        },
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      })

      // Update last read
      await prisma.channelMember.updateMany({
        where: {
          userId: req.userId!,
          channelId: req.params.channelId,
        },
        data: { lastReadAt: new Date() },
      })

      // Transform reactions to grouped format
      const transformedMessages = messages.reverse().map(msg => ({
        id: msg.id,
        content: msg.content,
        user: msg.user,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
        isEdited: msg.isEdited,
        files: msg.files,
        threadCount: msg._count.replies,
        threadLatestReply: msg.replies[0]?.createdAt || null,
        reactions: groupReactions(msg.reactions),
      }))

      res.json({
        messages: transformedMessages,
        hasMore: messages.length === parseInt(limit as string),
      })
    } catch (error) {
      next(error)
    }
  }
)

// Helper function to group reactions
function groupReactions(reactions: Array<{ emoji: string; user: { id: string } }>) {
  const grouped: Record<string, { emoji: string; count: number; users: string[] }> = {}

  for (const r of reactions) {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [] }
    }
    grouped[r.emoji].count++
    grouped[r.emoji].users.push(r.user.id)
  }

  return Object.values(grouped)
}

// Send message
router.post(
  '/channels/:channelId/messages',
  authenticate,
  [
    body('content').trim().isLength({ min: 1, max: 40000 }),
    body('parentId').optional().isUUID(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      // Check channel access
      const channel = await prisma.channel.findUnique({
        where: { id: req.params.channelId },
      })

      if (!channel) {
        throw new AppError('Channel not found', 404, 'NOT_FOUND')
      }

      // Check membership
      const membership = await prisma.channelMember.findUnique({
        where: {
          userId_channelId: {
            userId: req.userId!,
            channelId: channel.id,
          },
        },
      })

      if (!membership) {
        throw new AppError('Not a member of this channel', 403, 'FORBIDDEN')
      }

      const { content, parentId } = req.body

      // Validate parentId if provided
      if (parentId) {
        const parent = await prisma.message.findUnique({
          where: { id: parentId },
        })
        if (!parent || parent.channelId !== channel.id) {
          throw new AppError('Invalid parent message', 400, 'VALIDATION_ERROR')
        }
      }

      const message = await prisma.message.create({
        data: {
          content,
          channelId: channel.id,
          userId: req.userId!,
          parentId,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      })

      // Emit socket event
      io.to(`channel:${channel.id}`).emit('message:new', {
        ...message,
        reactions: [],
        files: [],
        threadCount: 0,
      })

      // Handle mentions for notifications
      const mentions = extractMentions(content)
      if (mentions.length > 0) {
        await createMentionNotifications(mentions, message, channel.id, req.userId!)
      }

      res.status(201).json({
        ...message,
        reactions: [],
        files: [],
        threadCount: 0,
      })
    } catch (error) {
      next(error)
    }
  }
)

// Extract @mentions from content
function extractMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g
  const matches = content.match(mentionRegex)
  return matches ? matches.map(m => m.slice(1)) : []
}

// Create notifications for mentions
async function createMentionNotifications(
  mentions: string[],
  message: { id: string; content: string; user: { displayName: string } },
  channelId: string,
  senderId: string
) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { members: { include: { user: true } } },
  })

  if (!channel) return

  for (const mention of mentions) {
    if (mention === 'channel' || mention === 'here') {
      // Notify all members
      for (const member of channel.members) {
        if (member.userId !== senderId) {
          await prisma.notification.create({
            data: {
              userId: member.userId,
              type: 'mention',
              content: `${message.user.displayName} mentioned @${mention} in #${channel.name}`,
              referenceId: message.id,
              referenceType: 'message',
            },
          })
        }
      }
    } else {
      // Find user by display name
      const user = await prisma.user.findFirst({
        where: { displayName: { equals: mention, mode: 'insensitive' } },
      })

      if (user && user.id !== senderId) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: 'mention',
            content: `${message.user.displayName} mentioned you in #${channel.name}`,
            referenceId: message.id,
            referenceType: 'message',
          },
        })
      }
    }
  }
}

// Edit message
router.patch(
  '/:messageId',
  authenticate,
  [body('content').trim().isLength({ min: 1, max: 40000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const message = await prisma.message.findUnique({
        where: { id: req.params.messageId },
      })

      if (!message) {
        throw new AppError('Message not found', 404, 'NOT_FOUND')
      }

      if (message.userId !== req.userId) {
        throw new AppError('Cannot edit others messages', 403, 'FORBIDDEN')
      }

      const { content } = req.body

      const updated = await prisma.message.update({
        where: { id: req.params.messageId },
        data: {
          content,
          isEdited: true,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      })

      io.to(`channel:${message.channelId}`).emit('message:update', updated)

      res.json(updated)
    } catch (error) {
      next(error)
    }
  }
)

// Delete message
router.delete('/:messageId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const message = await prisma.message.findUnique({
      where: { id: req.params.messageId },
      include: {
        channel: {
          include: {
            workspace: {
              include: {
                members: {
                  where: { userId: req.userId },
                },
              },
            },
          },
        },
      },
    })

    if (!message) {
      throw new AppError('Message not found', 404, 'NOT_FOUND')
    }

    // Check permission - own message or admin
    const isOwn = message.userId === req.userId
    const isAdmin = message.channel.workspace.members[0]?.role === 'owner' ||
                    message.channel.workspace.members[0]?.role === 'admin'

    if (!isOwn && !isAdmin) {
      throw new AppError('Cannot delete this message', 403, 'FORBIDDEN')
    }

    await prisma.message.delete({
      where: { id: req.params.messageId },
    })

    io.to(`channel:${message.channelId}`).emit('message:delete', { id: message.id })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

// Get thread
router.get('/:messageId/thread', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parent = await prisma.message.findUnique({
      where: { id: req.params.messageId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        reactions: {
          include: {
            user: { select: { id: true } },
          },
        },
        files: true,
      },
    })

    if (!parent) {
      throw new AppError('Message not found', 404, 'NOT_FOUND')
    }

    const replies = await prisma.message.findMany({
      where: { parentId: parent.id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        reactions: {
          include: {
            user: { select: { id: true } },
          },
        },
        files: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      parent: {
        ...parent,
        reactions: groupReactions(parent.reactions),
      },
      replies: replies.map(r => ({
        ...r,
        reactions: groupReactions(r.reactions),
      })),
    })
  } catch (error) {
    next(error)
  }
})

// Add reaction
router.post(
  '/:messageId/reactions',
  authenticate,
  [body('emoji').trim().isLength({ min: 1, max: 50 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const message = await prisma.message.findUnique({
        where: { id: req.params.messageId },
      })

      if (!message) {
        throw new AppError('Message not found', 404, 'NOT_FOUND')
      }

      const { emoji } = req.body

      // Check if already reacted
      const existing = await prisma.reaction.findUnique({
        where: {
          userId_messageId_emoji: {
            userId: req.userId!,
            messageId: message.id,
            emoji,
          },
        },
      })

      if (existing) {
        throw new AppError('Already reacted with this emoji', 409, 'CONFLICT')
      }

      const reaction = await prisma.reaction.create({
        data: {
          emoji,
          userId: req.userId!,
          messageId: message.id,
        },
      })

      io.to(`channel:${message.channelId}`).emit('reaction:add', {
        messageId: message.id,
        emoji,
        userId: req.userId,
      })

      res.status(201).json(reaction)
    } catch (error) {
      next(error)
    }
  }
)

// Remove reaction
router.delete('/:messageId/reactions/:emoji', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const message = await prisma.message.findUnique({
      where: { id: req.params.messageId },
    })

    if (!message) {
      throw new AppError('Message not found', 404, 'NOT_FOUND')
    }

    await prisma.reaction.delete({
      where: {
        userId_messageId_emoji: {
          userId: req.userId!,
          messageId: message.id,
          emoji: req.params.emoji,
        },
      },
    })

    io.to(`channel:${message.channelId}`).emit('reaction:remove', {
      messageId: message.id,
      emoji: req.params.emoji,
      userId: req.userId,
    })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
