import { Router, Response, NextFunction } from 'express'
import { body, query, validationResult } from 'express-validator'
import { prisma, io } from '../index'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'
import { createAndEmitNotification } from '../utils/notifications'

const router = Router()

// Get all DMs for current user
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dms = await prisma.directMessage.findMany({
      where: {
        OR: [
          { participant1Id: req.userId },
          { participant2Id: req.userId },
        ],
      },
      include: {
        participant1: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
        participant2: {
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            content: true,
            createdAt: true,
            senderId: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const result = dms.map(dm => {
      // For self DM, participant is the user themselves
      const isSelfDM = dm.participant1Id === dm.participant2Id
      const participant = isSelfDM
        ? dm.participant1
        : (dm.participant1Id === req.userId ? dm.participant2 : dm.participant1)

      return {
        id: dm.id,
        participant,
        lastMessage: dm.messages[0] || null,
        updatedAt: dm.updatedAt,
      }
    })

    res.json({ dms: result })
  } catch (error) {
    next(error)
  }
})

// Create or get DM with user
router.post(
  '/',
  authenticate,
  [body('userId').isUUID()],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { userId } = req.body

      // Self DM is allowed (like Slack's note to self feature)
      const isSelfDM = userId === req.userId

      // Check if user exists
      const targetUser = await prisma.user.findUnique({ where: { id: userId } })
      if (!targetUser) {
        throw new AppError('User not found', 404, 'NOT_FOUND')
      }

      // Check if DM already exists (check both directions)
      let dm = await prisma.directMessage.findFirst({
        where: {
          OR: [
            { participant1Id: req.userId, participant2Id: userId },
            { participant1Id: userId, participant2Id: req.userId },
          ],
        },
        include: {
          participant1: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              status: true,
            },
          },
          participant2: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              status: true,
            },
          },
        },
      })

      if (!dm) {
        dm = await prisma.directMessage.create({
          data: {
            participant1Id: req.userId!,
            participant2Id: userId,
          },
          include: {
            participant1: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                status: true,
              },
            },
            participant2: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        })
      }

      // For self DM, participant is the user themselves
      const participant = isSelfDM
        ? dm.participant1
        : (dm.participant1Id === req.userId ? dm.participant2 : dm.participant1)

      res.status(201).json({
        id: dm.id,
        participant,
      })
    } catch (error) {
      next(error)
    }
  }
)

// Get DM messages
router.get(
  '/:dmId/messages',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('before').optional().isUUID(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { limit = '50', before } = req.query

      const dm = await prisma.directMessage.findUnique({
        where: { id: req.params.dmId },
      })

      if (!dm) {
        throw new AppError('DM not found', 404, 'NOT_FOUND')
      }

      // Check access
      if (dm.participant1Id !== req.userId && dm.participant2Id !== req.userId) {
        throw new AppError('Access denied', 403, 'FORBIDDEN')
      }

      let cursor = undefined
      if (before) {
        const beforeMsg = await prisma.dMMessage.findUnique({ where: { id: before as string } })
        if (beforeMsg) {
          cursor = { createdAt: { lt: beforeMsg.createdAt } }
        }
      }

      const messages = await prisma.dMMessage.findMany({
        where: {
          dmId: dm.id,
          ...cursor,
        },
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
      })

      res.json({
        messages: messages.reverse(),
        hasMore: messages.length === parseInt(limit as string),
      })
    } catch (error) {
      next(error)
    }
  }
)

// Send DM message
router.post(
  '/:dmId/messages',
  authenticate,
  [body('content').trim().isLength({ min: 1, max: 40000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const dm = await prisma.directMessage.findUnique({
        where: { id: req.params.dmId },
      })

      if (!dm) {
        throw new AppError('DM not found', 404, 'NOT_FOUND')
      }

      // Check access
      if (dm.participant1Id !== req.userId && dm.participant2Id !== req.userId) {
        throw new AppError('Access denied', 403, 'FORBIDDEN')
      }

      const { content } = req.body

      const message = await prisma.dMMessage.create({
        data: {
          dmId: dm.id,
          senderId: req.userId!,
          content,
        },
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      })

      // Update DM timestamp
      await prisma.directMessage.update({
        where: { id: dm.id },
        data: { updatedAt: new Date() },
      })

      // Emit to both participants
      io.to(`user:${dm.participant1Id}`).emit('dm:new', message)
      io.to(`user:${dm.participant2Id}`).emit('dm:new', message)

      // Create notification for recipient
      const recipientId = dm.participant1Id === req.userId
        ? dm.participant2Id
        : dm.participant1Id

      await createAndEmitNotification({
        userId: recipientId,
        type: 'dm',
        content: `${message.sender.displayName}さんからメッセージが届きました`,
        referenceId: dm.id,
        referenceType: 'dm',
      })

      res.status(201).json(message)
    } catch (error) {
      next(error)
    }
  }
)

// Edit DM message
router.patch(
  '/:dmId/messages/:messageId',
  authenticate,
  [body('content').trim().isLength({ min: 1, max: 40000 })],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const message = await prisma.dMMessage.findUnique({
        where: { id: req.params.messageId },
      })

      if (!message) {
        throw new AppError('Message not found', 404, 'NOT_FOUND')
      }

      if (message.senderId !== req.userId) {
        throw new AppError('Cannot edit others messages', 403, 'FORBIDDEN')
      }

      if (message.dmId !== req.params.dmId) {
        throw new AppError('Message not in this DM', 400, 'VALIDATION_ERROR')
      }

      const { content } = req.body

      const updated = await prisma.dMMessage.update({
        where: { id: req.params.messageId },
        data: {
          content,
          isEdited: true,
        },
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      })

      const dm = await prisma.directMessage.findUnique({
        where: { id: message.dmId },
      })

      if (dm) {
        io.to(`user:${dm.participant1Id}`).emit('dm:update', updated)
        io.to(`user:${dm.participant2Id}`).emit('dm:update', updated)
      }

      res.json(updated)
    } catch (error) {
      next(error)
    }
  }
)

// Delete DM message
router.delete('/:dmId/messages/:messageId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const message = await prisma.dMMessage.findUnique({
      where: { id: req.params.messageId },
    })

    if (!message) {
      throw new AppError('Message not found', 404, 'NOT_FOUND')
    }

    if (message.senderId !== req.userId) {
      throw new AppError('Cannot delete others messages', 403, 'FORBIDDEN')
    }

    if (message.dmId !== req.params.dmId) {
      throw new AppError('Message not in this DM', 400, 'VALIDATION_ERROR')
    }

    await prisma.dMMessage.delete({
      where: { id: req.params.messageId },
    })

    const dm = await prisma.directMessage.findUnique({
      where: { id: message.dmId },
    })

    if (dm) {
      io.to(`user:${dm.participant1Id}`).emit('dm:delete', { id: message.id, dmId: dm.id })
      io.to(`user:${dm.participant2Id}`).emit('dm:delete', { id: message.id, dmId: dm.id })
    }

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
