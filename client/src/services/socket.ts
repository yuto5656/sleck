import { io, Socket } from 'socket.io-client'
import { Message, DMMessage } from '../types'

class SocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()

  connect(token: string) {
    if (this.socket?.connected) {
      return
    }

    this.socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    this.socket.on('connect', () => {
      console.log('Socket connected')
    })

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    // Re-register all listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket?.on(event, callback)
      })
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  on<T>(event: string, callback: (data: T) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback as (...args: unknown[]) => void)

    if (this.socket) {
      this.socket.on(event, callback)
    }

    // Return cleanup function
    return () => {
      this.listeners.get(event)?.delete(callback as (...args: unknown[]) => void)
      this.socket?.off(event, callback)
    }
  }

  off(event: string, callback?: (...args: unknown[]) => void) {
    if (callback) {
      this.listeners.get(event)?.delete(callback)
      this.socket?.off(event, callback)
    } else {
      this.listeners.delete(event)
      this.socket?.off(event)
    }
  }

  emit(event: string, data?: unknown) {
    this.socket?.emit(event, data)
  }

  // Channel events
  joinChannel(channelId: string) {
    this.emit('channel:join', channelId)
  }

  leaveChannel(channelId: string) {
    this.emit('channel:leave', channelId)
  }

  // Typing events
  startTyping(data: { channelId?: string; dmId?: string }) {
    this.emit('typing:start', data)
  }

  stopTyping(data: { channelId?: string; dmId?: string }) {
    this.emit('typing:stop', data)
  }

  // Presence events
  updatePresence(status: 'online' | 'away' | 'dnd') {
    this.emit('presence:update', status)
  }

  // Message listeners
  onNewMessage(callback: (message: Message) => void) {
    return this.on('message:new', callback)
  }

  onMessageUpdate(callback: (message: Message) => void) {
    return this.on('message:update', callback)
  }

  onMessageDelete(callback: (data: { id: string }) => void) {
    return this.on('message:delete', callback)
  }

  // Reaction listeners
  onReactionAdd(callback: (data: { messageId: string; emoji: string; userId: string }) => void) {
    return this.on('reaction:add', callback)
  }

  onReactionRemove(callback: (data: { messageId: string; emoji: string; userId: string }) => void) {
    return this.on('reaction:remove', callback)
  }

  // DM listeners
  onNewDM(callback: (message: DMMessage) => void) {
    return this.on('dm:new', callback)
  }

  onDMUpdate(callback: (message: DMMessage) => void) {
    return this.on('dm:update', callback)
  }

  onDMDelete(callback: (data: { id: string; dmId: string }) => void) {
    return this.on('dm:delete', callback)
  }

  // Typing listeners
  onTypingStart(callback: (data: { userId: string; channelId?: string; dmId?: string }) => void) {
    return this.on('typing:start', callback)
  }

  onTypingStop(callback: (data: { userId: string; channelId?: string; dmId?: string }) => void) {
    return this.on('typing:stop', callback)
  }

  // User status listeners
  onUserOnline(callback: (data: { userId: string }) => void) {
    return this.on('user:online', callback)
  }

  onUserOffline(callback: (data: { userId: string }) => void) {
    return this.on('user:offline', callback)
  }

  onUserStatus(callback: (data: { userId: string; status: string }) => void) {
    return this.on('user:status', callback)
  }

  // Channel listeners
  onChannelCreated(callback: (channel: { id: string; name: string; description: string | null; isPrivate: boolean; memberCount: number; createdAt: string }) => void) {
    return this.on('channel:created', callback)
  }

  onChannelDeleted(callback: (data: { channelId: string }) => void) {
    return this.on('channel:deleted', callback)
  }
}

export const socketService = new SocketService()
