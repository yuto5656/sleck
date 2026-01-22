import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt, { SignOptions } from 'jsonwebtoken'
import crypto from 'crypto'
import { body, validationResult } from 'express-validator'
import { prisma } from '../index'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'
import { sendPasswordResetEmail } from '../services/email'

const router = Router()

// Generate a secure random token
const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex')
}

const generateTokens = (userId: string) => {
  const accessTokenOptions: SignOptions = {
    expiresIn: 86400 // 24 hours in seconds
  }
  const refreshTokenOptions: SignOptions = {
    expiresIn: 2592000 // 30 days in seconds
  }

  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'secret',
    accessTokenOptions
  )

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    refreshTokenOptions
  )

  return { accessToken, refreshToken }
}

// Register (requires invite token)
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('displayName').trim().isLength({ min: 1, max: 100 }),
    body('inviteToken').notEmpty().withMessage('招待トークンが必要です'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { email, password, displayName, inviteToken } = req.body

      // Validate invite token
      const invite = await prisma.workspaceInvite.findUnique({
        where: { token: inviteToken },
        include: { workspace: true },
      })

      if (!invite) {
        throw new AppError('無効な招待トークンです', 400, 'INVALID_INVITE')
      }

      if (invite.expiresAt < new Date()) {
        throw new AppError('招待リンクの有効期限が切れています', 400, 'INVITE_EXPIRED')
      }

      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        throw new AppError('Email already exists', 409, 'CONFLICT')
      }

      const passwordHash = await bcrypt.hash(password, 12)

      // Create user and add to workspace in transaction
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName,
            status: 'online',
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            status: true,
            createdAt: true,
          },
        })

        // Add user to workspace
        await tx.workspaceMember.create({
          data: {
            userId: user.id,
            workspaceId: invite.workspaceId,
            role: 'member',
          },
        })

        // Add user to general channel
        const generalChannel = await tx.channel.findFirst({
          where: {
            workspaceId: invite.workspaceId,
            name: { equals: 'general', mode: 'insensitive' },
          },
        })

        if (generalChannel) {
          await tx.channelMember.create({
            data: {
              userId: user.id,
              channelId: generalChannel.id,
            },
          })
        }

        return user
      })

      const tokens = generateTokens(result.id)

      res.status(201).json({
        user: result,
        ...tokens,
      })
    } catch (error) {
      next(error)
    }
  }
)

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').exists(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { email, password } = req.body

      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED')
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash)
      if (!isValidPassword) {
        throw new AppError('Invalid credentials', 401, 'UNAUTHORIZED')
      }

      // Update status to online
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'online' },
      })

      const tokens = generateTokens(user.id)

      res.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          status: 'online',
          statusMessage: user.statusMessage,
          createdAt: user.createdAt,
        },
        ...tokens,
      })
    } catch (error) {
      next(error)
    }
  }
)

// Refresh token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      throw new AppError('Refresh token required', 400, 'VALIDATION_ERROR')
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'refresh-secret'
    ) as { userId: string }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND')
    }

    const tokens = generateTokens(user.id)

    res.json(tokens)
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Refresh token expired', 401, 'TOKEN_EXPIRED'))
    }
    next(error)
  }
})

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { status: 'offline' },
    })

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

// Forgot password - request reset
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { email } = req.body

      // Always return success to prevent email enumeration
      const user = await prisma.user.findUnique({ where: { email } })

      if (user) {
        // Invalidate any existing tokens
        await prisma.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        })

        // Create new reset token
        const token = generateResetToken()
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            token,
            expiresAt,
          },
        })

        // Send password reset email
        const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${token}`
        await sendPasswordResetEmail(email, resetUrl)
      }

      // Always return success
      res.json({ message: 'If an account with that email exists, a password reset link has been sent.' })
    } catch (error) {
      next(error)
    }
  }
)

// Reset password - with token
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { token, password } = req.body

      // Find valid token
      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true },
      })

      if (!resetToken) {
        throw new AppError('Invalid or expired reset token', 400, 'INVALID_TOKEN')
      }

      if (resetToken.usedAt) {
        throw new AppError('This reset link has already been used', 400, 'TOKEN_USED')
      }

      if (resetToken.expiresAt < new Date()) {
        throw new AppError('This reset link has expired', 400, 'TOKEN_EXPIRED')
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 12)

      // Update password and mark token as used
      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
      ])

      res.json({ message: 'Password has been reset successfully' })
    } catch (error) {
      next(error)
    }
  }
)

export default router
