import { Router, Response, NextFunction } from 'express'
import { body, query, validationResult } from 'express-validator'
import { prisma, io } from '../index'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Create channel in workspace (Note: This route is not used - see workspaces.ts)
router.post(
  '/workspaces/:workspaceId/channels',
  authenticate,
  [
    body('name').trim().isLength({ min: 1, max: 80 }),
    body('description').optional().trim(),
    body('isPrivate').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: req.userId!,
            workspaceId: req.params.workspaceId,
          },
        },
      })

      if (!membership) {
        throw new AppError('Workspace not found or access denied', 404, 'NOT_FOUND')
      }

      const { name, description, isPrivate = false } = req.body

      // Check if private channel creation is allowed
      if (isPrivate && membership.role === 'member') {
        throw new AppError('Only admins can create private channels', 403, 'FORBIDDEN')
      }

      // Check for duplicate name
      const existing = await prisma.channel.findUnique({
        where: {
          workspaceId_name: {
            workspaceId: req.params.workspaceId,
            name,
          },
        },
      })

      if (existing) {
        throw new AppError('Channel name already exists', 409, 'CONFLICT')
      }

      const channel = await prisma.channel.create({
        data: {
          name,
          description,
          isPrivate,
          workspaceId: req.params.workspaceId,
          createdById: req.userId!,
          members: {
            create: {
              userId: req.userId!,
            },
          },
        },
      })

      res.status(201).json(channel)
    } catch (error) {
      next(error)
    }
  }
)

// Get channel by ID
router.get('/:channelId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.channelId },
      include: {
        _count: {
          select: { members: true, messages: true },
        },
        createdBy: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    })

    if (!channel) {
      throw new AppError('Channel not found', 404, 'NOT_FOUND')
    }

    // Check access for private channels
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

    res.json({
      ...channel,
      memberCount: channel._count.members,
      messageCount: channel._count.messages,
    })
  } catch (error) {
    next(error)
  }
})

// Update channel
router.patch(
  '/:channelId',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 1, max: 80 }),
    body('description').optional().trim(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const channel = await prisma.channel.findUnique({
        where: { id: req.params.channelId },
        include: {
          workspace: {
            include: {
              members: {
                where: { userId: req.userId },
              },
            },
          },
        },
      })

      if (!channel) {
        throw new AppError('Channel not found', 404, 'NOT_FOUND')
      }

      // Check permission
      const workspaceMembership = channel.workspace.members[0]
      if (!workspaceMembership || !['owner', 'admin'].includes(workspaceMembership.role)) {
        throw new AppError('Permission denied', 403, 'FORBIDDEN')
      }

      const { name, description } = req.body

      // Check for duplicate name if changing
      if (name && name !== channel.name) {
        const existing = await prisma.channel.findUnique({
          where: {
            workspaceId_name: {
              workspaceId: channel.workspaceId,
              name,
            },
          },
        })

        if (existing) {
          throw new AppError('Channel name already exists', 409, 'CONFLICT')
        }
      }

      const updated = await prisma.channel.update({
        where: { id: req.params.channelId },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
        },
      })

      res.json(updated)
    } catch (error) {
      next(error)
    }
  }
)

// Delete channel
router.delete('/:channelId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.channelId },
      include: {
        workspace: {
          include: {
            members: {
              where: { userId: req.userId },
            },
          },
        },
      },
    })

    if (!channel) {
      throw new AppError('Channel not found', 404, 'NOT_FOUND')
    }

    // Prevent deletion of General channel
    if (channel.name.toLowerCase() === 'general') {
      throw new AppError('Generalチャンネルは削除できません', 400, 'VALIDATION_ERROR')
    }

    // Get user role
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    })

    // Check permission - only admin or deputy_admin can delete channels
    if (!user || !['admin', 'deputy_admin'].includes(user.role)) {
      throw new AppError('チャンネルを削除する権限がありません', 403, 'FORBIDDEN')
    }

    await prisma.channel.delete({
      where: { id: req.params.channelId },
    })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

// Join channel
router.post('/:channelId/join', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.channelId },
    })

    if (!channel) {
      throw new AppError('Channel not found', 404, 'NOT_FOUND')
    }

    if (channel.isPrivate) {
      throw new AppError('Cannot join private channel without invitation', 403, 'FORBIDDEN')
    }

    // Check workspace membership
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: req.userId!,
          workspaceId: channel.workspaceId,
        },
      },
    })

    if (!workspaceMember) {
      throw new AppError('Must be a workspace member', 403, 'FORBIDDEN')
    }

    // Check if already a member
    const existing = await prisma.channelMember.findUnique({
      where: {
        userId_channelId: {
          userId: req.userId!,
          channelId: channel.id,
        },
      },
    })

    if (existing) {
      return res.json({ message: 'Already a member' })
    }

    await prisma.channelMember.create({
      data: {
        userId: req.userId!,
        channelId: channel.id,
      },
    })

    res.status(201).json({ message: 'Joined channel' })
  } catch (error) {
    next(error)
  }
})

// Leave channel
router.post('/:channelId/leave', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const membership = await prisma.channelMember.findUnique({
      where: {
        userId_channelId: {
          userId: req.userId!,
          channelId: req.params.channelId,
        },
      },
    })

    if (!membership) {
      throw new AppError('Not a member of this channel', 404, 'NOT_FOUND')
    }

    // Check if last member
    const memberCount = await prisma.channelMember.count({
      where: { channelId: req.params.channelId },
    })

    if (memberCount <= 1) {
      throw new AppError('Cannot leave: you are the last member', 400, 'VALIDATION_ERROR')
    }

    await prisma.channelMember.delete({
      where: {
        userId_channelId: {
          userId: req.userId!,
          channelId: req.params.channelId,
        },
      },
    })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

// Get messages for a channel
router.get(
  '/:channelId/messages',
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

// Send message to channel
router.post(
  '/:channelId/messages',
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

// Add member to channel (for private channels)
router.post(
  '/:channelId/members',
  authenticate,
  [body('userId').isUUID()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const channel = await prisma.channel.findUnique({
        where: { id: req.params.channelId },
        include: {
          workspace: {
            include: {
              members: {
                where: { userId: req.userId },
              },
            },
          },
        },
      })

      if (!channel) {
        throw new AppError('Channel not found', 404, 'NOT_FOUND')
      }

      // Check if requester is a member of the channel
      const requesterMembership = await prisma.channelMember.findUnique({
        where: {
          userId_channelId: {
            userId: req.userId!,
            channelId: channel.id,
          },
        },
      })

      if (!requesterMembership) {
        throw new AppError('You must be a member of the channel to add members', 403, 'FORBIDDEN')
      }

      const { userId } = req.body

      // Check if target user is a workspace member
      const targetWorkspaceMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: channel.workspaceId,
          },
        },
      })

      if (!targetWorkspaceMember) {
        throw new AppError('User must be a workspace member', 400, 'VALIDATION_ERROR')
      }

      // Check if already a member
      const existing = await prisma.channelMember.findUnique({
        where: {
          userId_channelId: {
            userId,
            channelId: channel.id,
          },
        },
      })

      if (existing) {
        throw new AppError('User is already a member', 409, 'CONFLICT')
      }

      // Add member
      await prisma.channelMember.create({
        data: {
          userId,
          channelId: channel.id,
        },
      })

      // Get the added user details
      const addedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          status: true,
        },
      })

      // Notify the added user via socket
      io.to(`user:${userId}`).emit('channel:added', {
        channelId: channel.id,
        channelName: channel.name,
        workspaceId: channel.workspaceId,
      })

      res.status(201).json({
        message: 'Member added successfully',
        member: addedUser,
      })
    } catch (error) {
      next(error)
    }
  }
)

// Get channel members
router.get('/:channelId/members', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: req.params.channelId },
    })

    if (!channel) {
      throw new AppError('Channel not found', 404, 'NOT_FOUND')
    }

    // Check access
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

    const members = await prisma.channelMember.findMany({
      where: { channelId: req.params.channelId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
    })

    res.json({
      members: members.map(m => ({
        ...m.user,
        joinedAt: m.joinedAt,
      })),
    })
  } catch (error) {
    next(error)
  }
})

export default router
