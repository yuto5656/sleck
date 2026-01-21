import { Router, Response, NextFunction } from 'express'
import { query, validationResult } from 'express-validator'
import { prisma } from '../index'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Global search
router.get(
  '/',
  authenticate,
  [
    query('q').trim().isLength({ min: 1 }),
    query('type').optional().isIn(['messages', 'files', 'users', 'channels']),
    query('channelId').optional().isUUID(),
    query('userId').optional().isUUID(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const {
        q,
        type,
        channelId,
        userId,
        from,
        to,
        limit = '20',
        offset = '0',
      } = req.query

      const searchQuery = q as string
      const limitNum = parseInt(limit as string)
      const offsetNum = parseInt(offset as string)

      const results: {
        messages?: unknown[]
        files?: unknown[]
        users?: unknown[]
        channels?: unknown[]
      } = {}

      let total = 0

      // Get user's workspaces
      const userWorkspaces = await prisma.workspaceMember.findMany({
        where: { userId: req.userId },
        select: { workspaceId: true },
      })
      const workspaceIds = userWorkspaces.map(w => w.workspaceId)

      // Get accessible channels
      const accessibleChannels = await prisma.channel.findMany({
        where: {
          workspaceId: { in: workspaceIds },
          OR: [
            { isPrivate: false },
            { members: { some: { userId: req.userId } } },
          ],
        },
        select: { id: true },
      })
      const channelIds = accessibleChannels.map(c => c.id)

      // Search messages
      if (!type || type === 'messages') {
        const messageWhere: Record<string, unknown> = {
          channelId: channelId ? channelId as string : { in: channelIds },
          content: { contains: searchQuery, mode: 'insensitive' },
        }

        if (userId) {
          messageWhere.userId = userId as string
        }

        if (from || to) {
          messageWhere.createdAt = {}
          if (from) (messageWhere.createdAt as Record<string, Date>).gte = new Date(from as string)
          if (to) (messageWhere.createdAt as Record<string, Date>).lte = new Date(to as string)
        }

        const messages = await prisma.message.findMany({
          where: messageWhere,
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            channel: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          take: limitNum,
          skip: offsetNum,
          orderBy: { createdAt: 'desc' },
        })

        const messageCount = await prisma.message.count({ where: messageWhere })

        results.messages = messages
        total += messageCount
      }

      // Search files
      if (!type || type === 'files') {
        const fileWhere: Record<string, unknown> = {
          originalName: { contains: searchQuery, mode: 'insensitive' },
          message: {
            channelId: channelId ? channelId as string : { in: channelIds },
          },
        }

        if (from || to) {
          fileWhere.createdAt = {}
          if (from) (fileWhere.createdAt as Record<string, Date>).gte = new Date(from as string)
          if (to) (fileWhere.createdAt as Record<string, Date>).lte = new Date(to as string)
        }

        const files = await prisma.file.findMany({
          where: fileWhere,
          include: {
            uploadedBy: {
              select: {
                id: true,
                displayName: true,
              },
            },
            message: {
              select: {
                channelId: true,
                channel: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          take: limitNum,
          skip: offsetNum,
          orderBy: { createdAt: 'desc' },
        })

        const fileCount = await prisma.file.count({ where: fileWhere })

        results.files = files
        total += fileCount
      }

      // Search users
      if (!type || type === 'users') {
        const users = await prisma.user.findMany({
          where: {
            displayName: { contains: searchQuery, mode: 'insensitive' },
            workspaces: {
              some: { workspaceId: { in: workspaceIds } },
            },
          },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
          take: limitNum,
          skip: offsetNum,
        })

        const userCount = await prisma.user.count({
          where: {
            displayName: { contains: searchQuery, mode: 'insensitive' },
            workspaces: {
              some: { workspaceId: { in: workspaceIds } },
            },
          },
        })

        results.users = users
        total += userCount
      }

      // Search channels
      if (!type || type === 'channels') {
        const channels = await prisma.channel.findMany({
          where: {
            workspaceId: { in: workspaceIds },
            name: { contains: searchQuery, mode: 'insensitive' },
            OR: [
              { isPrivate: false },
              { members: { some: { userId: req.userId } } },
            ],
          },
          select: {
            id: true,
            name: true,
            description: true,
            isPrivate: true,
            _count: { select: { members: true } },
          },
          take: limitNum,
          skip: offsetNum,
        })

        const channelCount = await prisma.channel.count({
          where: {
            workspaceId: { in: workspaceIds },
            name: { contains: searchQuery, mode: 'insensitive' },
            OR: [
              { isPrivate: false },
              { members: { some: { userId: req.userId } } },
            ],
          },
        })

        results.channels = channels.map(c => ({
          ...c,
          memberCount: c._count.members,
        }))
        total += channelCount
      }

      res.json({ results, total })
    } catch (error) {
      next(error)
    }
  }
)

export default router
