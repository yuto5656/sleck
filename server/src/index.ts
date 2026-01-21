import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import workspaceRoutes from './routes/workspaces'
import channelRoutes from './routes/channels'
import messageRoutes from './routes/messages'
import dmRoutes from './routes/dms'
import fileRoutes from './routes/files'
import searchRoutes from './routes/search'
import notificationRoutes from './routes/notifications'
import { setupSocketHandlers } from './socket'
import { errorHandler } from './middleware/errorHandler'

dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

export const prisma = new PrismaClient()

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use('/uploads', express.static('uploads'))

// Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/workspaces', workspaceRoutes)
app.use('/api/v1/channels', channelRoutes)
app.use('/api/v1/messages', messageRoutes)
app.use('/api/v1/dms', dmRoutes)
app.use('/api/v1/files', fileRoutes)
app.use('/api/v1/search', searchRoutes)
app.use('/api/v1/notifications', notificationRoutes)

// Error handler
app.use(errorHandler)

// Socket.io setup
setupSocketHandlers(io)

// Export io for use in other modules
export { io }

const PORT = process.env.PORT || 3001

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
