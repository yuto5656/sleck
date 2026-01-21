import { Router, Response, NextFunction } from 'express'
import { query, validationResult } from 'express-validator'
import { prisma } from '../index'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Get notifications
router.get(
  '/',
  authenticate,
  [
    query('unreadOnly').optional().isBoolean(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { unreadOnly, limit = '50', offset = '0' } = req.query

      const where: Record<string, unknown> = {
        userId: req.userId,
      }

      if (unreadOnly === 'true') {
        where.isRead = false
      }

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
          orderBy: { createdAt: 'desc' },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: {
            userId: req.userId,
            isRead: false,
          },
        }),
      ])

      res.json({
        notifications,
        total,
        unreadCount,
      })
    } catch (error) {
      next(error)
    }
  }
)

// Mark notification as read
router.patch('/:notificationId/read', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.notificationId },
    })

    if (!notification) {
      throw new AppError('Notification not found', 404, 'NOT_FOUND')
    }

    if (notification.userId !== req.userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN')
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.notificationId },
      data: { isRead: true },
    })

    res.json(updated)
  } catch (error) {
    next(error)
  }
})

// Mark all notifications as read
router.post('/read-all', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.userId,
        isRead: false,
      },
      data: { isRead: true },
    })

    res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    next(error)
  }
})

// Delete notification
router.delete('/:notificationId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: req.params.notificationId },
    })

    if (!notification) {
      throw new AppError('Notification not found', 404, 'NOT_FOUND')
    }

    if (notification.userId !== req.userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN')
    }

    await prisma.notification.delete({
      where: { id: req.params.notificationId },
    })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

// Clear all notifications
router.delete('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.deleteMany({
      where: { userId: req.userId },
    })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
