import { Router, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import crypto from 'crypto'
import { prisma } from '../index'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'
import multer from 'multer'
import { uploadAvatar } from '../services/supabaseStorage'

// Generate a secure random token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

const router = Router()

// File upload config for avatar (memory storage for Supabase upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  },
})

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        statusMessage: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND')
    }

    res.json(user)
  } catch (error) {
    next(error)
  }
})

// Update profile
router.patch(
  '/me',
  authenticate,
  [
    body('displayName').optional().trim().isLength({ min: 1, max: 100 }),
    body('statusMessage').optional().trim().isLength({ max: 100 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { displayName, statusMessage } = req.body

      const user = await prisma.user.update({
        where: { id: req.userId },
        data: {
          ...(displayName && { displayName }),
          ...(statusMessage !== undefined && { statusMessage }),
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          status: true,
          statusMessage: true,
          createdAt: true,
        },
      })

      res.json(user)
    } catch (error) {
      next(error)
    }
  }
)

// Update status
router.patch(
  '/me/status',
  authenticate,
  [body('status').isIn(['online', 'away', 'dnd', 'offline'])],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { status } = req.body

      const user = await prisma.user.update({
        where: { id: req.userId },
        data: { status },
        select: {
          id: true,
          status: true,
        },
      })

      res.json(user)
    } catch (error) {
      next(error)
    }
  }
)

// Upload avatar
router.post(
  '/me/avatar',
  authenticate,
  upload.single('avatar'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400, 'VALIDATION_ERROR')
      }

      // Upload to Supabase Storage
      const avatarUrl = await uploadAvatar(
        req.userId!,
        req.file.buffer,
        req.file.mimetype
      )

      const user = await prisma.user.update({
        where: { id: req.userId },
        data: { avatarUrl },
        select: {
          id: true,
          avatarUrl: true,
        },
      })

      res.json(user)
    } catch (error) {
      next(error)
    }
  }
)

// Get user by ID
router.get('/:userId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        statusMessage: true,
        role: true,
      },
    })

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND')
    }

    res.json(user)
  } catch (error) {
    next(error)
  }
})

// Get all users (admin only)
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check if requester is admin
    const requester = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    })

    if (!requester || requester.role !== 'admin') {
      throw new AppError('管理者のみがユーザー一覧を取得できます', 403, 'FORBIDDEN')
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        status: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    res.json({ users })
  } catch (error) {
    next(error)
  }
})

// Update user role (admin only)
router.patch(
  '/:userId/role',
  authenticate,
  [body('role').isIn(['deputy_admin', 'member'])],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      // Check if requester is admin
      const requester = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true },
      })

      if (!requester || requester.role !== 'admin') {
        throw new AppError('管理者のみがロールを変更できます', 403, 'FORBIDDEN')
      }

      // Prevent changing admin's own role
      if (req.params.userId === req.userId) {
        throw new AppError('自分のロールは変更できません', 400, 'VALIDATION_ERROR')
      }

      // Check target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: req.params.userId },
        select: { role: true },
      })

      if (!targetUser) {
        throw new AppError('ユーザーが見つかりません', 404, 'NOT_FOUND')
      }

      // Prevent changing admin role
      if (targetUser.role === 'admin') {
        throw new AppError('管理者のロールは変更できません', 400, 'VALIDATION_ERROR')
      }

      const { role } = req.body

      const user = await prisma.user.update({
        where: { id: req.params.userId },
        data: { role },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
        },
      })

      res.json(user)
    } catch (error) {
      next(error)
    }
  }
)

// Generate password reset link for user (admin only)
router.post(
  '/:userId/generate-reset-link',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Check if requester is admin
      const requester = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true },
      })

      if (!requester || requester.role !== 'admin') {
        throw new AppError('管理者のみがリセットリンクを生成できます', 403, 'FORBIDDEN')
      }

      // Prevent generating for own account
      if (req.params.userId === req.userId) {
        throw new AppError('自分のリセットリンクは生成できません', 400, 'VALIDATION_ERROR')
      }

      // Check target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: req.params.userId },
        select: { id: true, role: true, displayName: true },
      })

      if (!targetUser) {
        throw new AppError('ユーザーが見つかりません', 404, 'NOT_FOUND')
      }

      // Prevent generating for admin
      if (targetUser.role === 'admin') {
        throw new AppError('管理者のリセットリンクは生成できません', 400, 'VALIDATION_ERROR')
      }

      // Invalidate any existing tokens for this user
      await prisma.passwordResetToken.updateMany({
        where: {
          userId: targetUser.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      })

      // Create new reset token (valid for 24 hours)
      const token = generateResetToken()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      await prisma.passwordResetToken.create({
        data: {
          userId: targetUser.id,
          token,
          expiresAt,
        },
      })

      // Generate reset URL
      const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`

      res.json({
        resetUrl,
        displayName: targetUser.displayName,
        expiresAt,
      })
    } catch (error) {
      next(error)
    }
  }
)

// Delete user (admin only)
router.delete('/:userId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Check if requester is admin
    const requester = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true },
    })

    if (!requester || requester.role !== 'admin') {
      throw new AppError('管理者のみがユーザーを削除できます', 403, 'FORBIDDEN')
    }

    // Prevent deleting self
    if (req.params.userId === req.userId) {
      throw new AppError('自分自身は削除できません', 400, 'VALIDATION_ERROR')
    }

    // Check target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { role: true },
    })

    if (!targetUser) {
      throw new AppError('ユーザーが見つかりません', 404, 'NOT_FOUND')
    }

    // Prevent deleting admin
    if (targetUser.role === 'admin') {
      throw new AppError('管理者は削除できません', 400, 'VALIDATION_ERROR')
    }

    // Delete user and all related data using transaction
    // Note: Many relations have onDelete: Cascade in schema, so deleting user will cascade
    await prisma.$transaction(async (tx) => {
      // Delete user's messages (no cascade)
      await tx.message.deleteMany({
        where: { userId: req.params.userId },
      })

      // Delete user's reactions (no cascade)
      await tx.reaction.deleteMany({
        where: { userId: req.params.userId },
      })

      // Delete user's channel memberships (no cascade)
      await tx.channelMember.deleteMany({
        where: { userId: req.params.userId },
      })

      // Delete user's workspace memberships (no cascade)
      await tx.workspaceMember.deleteMany({
        where: { userId: req.params.userId },
      })

      // Delete user's notifications (has cascade but delete explicitly for safety)
      await tx.notification.deleteMany({
        where: { userId: req.params.userId },
      })

      // Finally delete the user
      // This will cascade: DMMessage (sender), DirectMessage (participant1/2)
      await tx.user.delete({
        where: { id: req.params.userId },
      })
    })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
