import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { prisma } from '../index'

interface AuthenticatedSocket extends Socket {
  userId?: string
}

export function setupSocketHandlers(io: Server) {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token

      if (!token) {
        return next(new Error('Authentication required'))
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret'
      ) as { userId: string }

      socket.userId = decoded.userId

      // Update user status to online
      await prisma.user.update({
        where: { id: decoded.userId },
        data: { status: 'online' },
      })

      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.userId} connected`)

    // Join user's personal room
    socket.join(`user:${socket.userId}`)

    // Get user's workspaces and join workspace rooms
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: socket.userId },
      include: {
        workspace: {
          include: {
            channels: {
              include: {
                members: {
                  where: { userId: socket.userId },
                },
              },
            },
          },
        },
      },
    })

    for (const membership of memberships) {
      socket.join(`workspace:${membership.workspaceId}`)

      // Join channels user is a member of
      for (const channel of membership.workspace.channels) {
        if (channel.members.length > 0 || !channel.isPrivate) {
          socket.join(`channel:${channel.id}`)
        }
      }
    }

    // Broadcast online status
    for (const membership of memberships) {
      socket.to(`workspace:${membership.workspaceId}`).emit('user:online', {
        userId: socket.userId,
      })
    }

    // Handle joining a channel
    socket.on('channel:join', async (channelId: string) => {
      socket.join(`channel:${channelId}`)
    })

    // Handle leaving a channel
    socket.on('channel:leave', async (channelId: string) => {
      socket.leave(`channel:${channelId}`)
    })

    // Handle typing start
    socket.on('typing:start', async (data: { channelId?: string; dmId?: string }) => {
      if (data.channelId) {
        socket.to(`channel:${data.channelId}`).emit('typing:start', {
          userId: socket.userId,
          channelId: data.channelId,
        })
      } else if (data.dmId) {
        // Get the DM to find the other participant
        const dm = await prisma.directMessage.findUnique({
          where: { id: data.dmId },
        })

        if (dm) {
          const otherUserId = dm.participant1Id === socket.userId
            ? dm.participant2Id
            : dm.participant1Id

          socket.to(`user:${otherUserId}`).emit('typing:start', {
            userId: socket.userId,
            dmId: data.dmId,
          })
        }
      }
    })

    // Handle typing stop
    socket.on('typing:stop', async (data: { channelId?: string; dmId?: string }) => {
      if (data.channelId) {
        socket.to(`channel:${data.channelId}`).emit('typing:stop', {
          userId: socket.userId,
          channelId: data.channelId,
        })
      } else if (data.dmId) {
        const dm = await prisma.directMessage.findUnique({
          where: { id: data.dmId },
        })

        if (dm) {
          const otherUserId = dm.participant1Id === socket.userId
            ? dm.participant2Id
            : dm.participant1Id

          socket.to(`user:${otherUserId}`).emit('typing:stop', {
            userId: socket.userId,
            dmId: data.dmId,
          })
        }
      }
    })

    // Handle presence update
    socket.on('presence:update', async (status: 'online' | 'away' | 'dnd') => {
      await prisma.user.update({
        where: { id: socket.userId },
        data: { status },
      })

      // Broadcast to all workspaces
      for (const membership of memberships) {
        socket.to(`workspace:${membership.workspaceId}`).emit('user:status', {
          userId: socket.userId,
          status,
        })
      }
    })

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User ${socket.userId} disconnected`)

      // Update user status to offline
      await prisma.user.update({
        where: { id: socket.userId },
        data: { status: 'offline' },
      })

      // Broadcast offline status
      for (const membership of memberships) {
        socket.to(`workspace:${membership.workspaceId}`).emit('user:offline', {
          userId: socket.userId,
        })
      }
    })
  })
}
