import { prisma, io } from '../index'

interface CreateNotificationParams {
  userId: string
  type: 'mention' | 'dm' | 'thread' | 'reaction'
  content: string
  referenceId: string | null
  referenceType: string | null
}

export async function createAndEmitNotification(params: CreateNotificationParams) {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      content: params.content,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
    },
  })

  // Emit notification to user's personal room immediately
  io.to(`user:${params.userId}`).emit('notification:new', {
    id: notification.id,
    type: notification.type,
    content: notification.content,
    referenceId: notification.referenceId,
    referenceType: notification.referenceType,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  })

  return notification
}
