import { Router, Response, NextFunction } from 'express'
import { body, query, validationResult } from 'express-validator'
import { prisma } from '../index'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Get workspaces for current user
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.userId },
      include: {
        workspace: true,
      },
    })

    const workspaces = memberships.map(m => ({
      ...m.workspace,
      role: m.role,
    }))

    res.json({ workspaces })
  } catch (error) {
    next(error)
  }
})

// Create workspace
router.post(
  '/',
  authenticate,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim(),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        throw new AppError('Validation error', 400, 'VALIDATION_ERROR', errors.array())
      }

      const { name, description } = req.body

      // Generate slug from name
      const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      let slug = baseSlug
      let counter = 1

      while (await prisma.workspace.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`
        counter++
      }

      const workspace = await prisma.workspace.create({
        data: {
          name,
          slug,
          description,
          members: {
            create: {
              userId: req.userId!,
              role: 'owner',
            },
          },
          channels: {
            create: {
              name: 'general',
              description: 'General discussion',
              createdById: req.userId!,
              members: {
                create: {
                  userId: req.userId!,
                },
              },
            },
          },
        },
        include: {
          members: true,
          channels: true,
        },
      })

      res.status(201).json(workspace)
    } catch (error) {
      next(error)
    }
  }
)

// Get workspace by ID
router.get('/:workspaceId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: req.userId!,
          workspaceId: req.params.workspaceId,
        },
      },
      include: {
        workspace: true,
      },
    })

    if (!membership) {
      throw new AppError('Workspace not found or access denied', 404, 'NOT_FOUND')
    }

    res.json({
      ...membership.workspace,
      role: membership.role,
    })
  } catch (error) {
    next(error)
  }
})

// Update workspace
router.patch(
  '/:workspaceId',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('description').optional().trim(),
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

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        throw new AppError('Permission denied', 403, 'FORBIDDEN')
      }

      const { name, description } = req.body

      const workspace = await prisma.workspace.update({
        where: { id: req.params.workspaceId },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
        },
      })

      res.json(workspace)
    } catch (error) {
      next(error)
    }
  }
)

// Get workspace members
router.get(
  '/:workspaceId/members',
  authenticate,
  [
    query('search').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { search, limit = '50', offset = '0' } = req.query

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

      const members = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: req.params.workspaceId,
          ...(search && {
            user: {
              displayName: {
                contains: search as string,
                mode: 'insensitive',
              },
            },
          }),
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarUrl: true,
              status: true,
              statusMessage: true,
            },
          },
        },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        orderBy: {
          user: {
            displayName: 'asc',
          },
        },
      })

      res.json({
        members: members.map(m => ({
          ...m.user,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      })
    } catch (error) {
      next(error)
    }
  }
)

// Create channel in workspace
router.post(
  '/:workspaceId/channels',
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

// Get workspace channels
router.get('/:workspaceId/channels', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
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

    const channels = await prisma.channel.findMany({
      where: {
        workspaceId: req.params.workspaceId,
        OR: [
          { isPrivate: false },
          {
            members: {
              some: { userId: req.userId },
            },
          },
        ],
      },
      include: {
        _count: {
          select: { members: true },
        },
        members: {
          where: { userId: req.userId },
          select: { lastReadAt: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    res.json({
      channels: channels.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        isPrivate: c.isPrivate,
        memberCount: c._count.members,
        lastReadAt: c.members[0]?.lastReadAt,
        createdAt: c.createdAt,
      })),
    })
  } catch (error) {
    next(error)
  }
})

export default router
