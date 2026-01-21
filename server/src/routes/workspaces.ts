import { Router, Response, NextFunction } from 'express'
import { body, query, validationResult } from 'express-validator'
import crypto from 'crypto'
import { prisma } from '../index'
import { AppError } from '../middleware/errorHandler'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = Router()

// Generate a secure random token for invites
const generateInviteToken = () => {
  return crypto.randomBytes(16).toString('hex')
}

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

// Create invite link for workspace
router.post(
  '/:workspaceId/invites',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
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

      const token = generateInviteToken()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const invite = await prisma.workspaceInvite.create({
        data: {
          workspaceId: req.params.workspaceId,
          token,
          expiresAt,
          createdById: req.userId!,
        },
        include: {
          workspace: {
            select: { name: true },
          },
        },
      })

      const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/invite/${token}`

      res.status(201).json({
        id: invite.id,
        token: invite.token,
        inviteUrl,
        expiresAt: invite.expiresAt,
        workspaceName: invite.workspace.name,
      })
    } catch (error) {
      next(error)
    }
  }
)

// Get invite info (public - no auth required)
router.get('/invites/:token', async (req, res: Response, next: NextFunction) => {
  try {
    const invite = await prisma.workspaceInvite.findUnique({
      where: { token: req.params.token },
      include: {
        workspace: {
          select: { id: true, name: true, description: true },
        },
      },
    })

    if (!invite) {
      throw new AppError('Invalid invite link', 404, 'NOT_FOUND')
    }

    if (invite.usedAt) {
      throw new AppError('This invite link has already been used', 400, 'INVITE_USED')
    }

    if (invite.expiresAt < new Date()) {
      throw new AppError('This invite link has expired', 400, 'INVITE_EXPIRED')
    }

    res.json({
      workspace: invite.workspace,
      expiresAt: invite.expiresAt,
    })
  } catch (error) {
    next(error)
  }
})

// Accept invite and join workspace
router.post(
  '/invites/:token/accept',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const invite = await prisma.workspaceInvite.findUnique({
        where: { token: req.params.token },
        include: {
          workspace: true,
        },
      })

      if (!invite) {
        throw new AppError('Invalid invite link', 404, 'NOT_FOUND')
      }

      if (invite.expiresAt < new Date()) {
        throw new AppError('This invite link has expired', 400, 'INVITE_EXPIRED')
      }

      // Check if user is already a member
      const existingMembership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: req.userId!,
            workspaceId: invite.workspaceId,
          },
        },
      })

      if (existingMembership) {
        throw new AppError('You are already a member of this workspace', 400, 'ALREADY_MEMBER')
      }

      // Add user to workspace and general channel
      const generalChannel = await prisma.channel.findFirst({
        where: {
          workspaceId: invite.workspaceId,
          name: 'general',
        },
      })

      await prisma.$transaction([
        prisma.workspaceMember.create({
          data: {
            userId: req.userId!,
            workspaceId: invite.workspaceId,
            role: 'member',
          },
        }),
        ...(generalChannel
          ? [
              prisma.channelMember.create({
                data: {
                  userId: req.userId!,
                  channelId: generalChannel.id,
                },
              }),
            ]
          : []),
      ])

      res.json({
        message: 'Successfully joined workspace',
        workspace: invite.workspace,
      })
    } catch (error) {
      next(error)
    }
  }
)

export default router
