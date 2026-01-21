import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import { prisma } from '../index'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as string }
  )

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as string }
  )

  return { accessToken, refreshToken }
}

// Register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('displayName').trim().isLength({ min: 1, max: 100 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { email, password, displayName } = req.body

      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        throw new AppError('Email already exists', 409, 'CONFLICT')
      }

      const passwordHash = await bcrypt.hash(password, 12)

      const user = await prisma.user.create({
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

      const tokens = generateTokens(user.id)

      res.status(201).json({
        user,
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

export default router
