import { Message, DMMessage } from '../types'

const DB_NAME = 'sleck-cache'
const DB_VERSION = 2
const CHANNEL_MESSAGES_STORE = 'channelMessages'
const DM_MESSAGES_STORE = 'dmMessages'
const THREAD_STORE = 'threads'
const CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours
const THREAD_CACHE_EXPIRY = 5 * 60 * 1000 // 5 minutes for threads (shorter for freshness)

interface CachedMessages<T> {
  id: string // channelId or dmId
  messages: T[]
  hasMore: boolean
  cachedAt: number
}

interface CachedThread {
  id: string // parent message id
  replies: Message[]
  cachedAt: number
}

class MessageCacheService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.warn('IndexedDB not available, cache disabled')
        resolve()
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(CHANNEL_MESSAGES_STORE)) {
          db.createObjectStore(CHANNEL_MESSAGES_STORE, { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains(DM_MESSAGES_STORE)) {
          db.createObjectStore(DM_MESSAGES_STORE, { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains(THREAD_STORE)) {
          db.createObjectStore(THREAD_STORE, { keyPath: 'id' })
        }
      }
    })

    return this.initPromise
  }

  async getChannelMessages(channelId: string): Promise<{ messages: Message[]; hasMore: boolean } | null> {
    await this.init()
    if (!this.db) return null

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(CHANNEL_MESSAGES_STORE, 'readonly')
        const store = transaction.objectStore(CHANNEL_MESSAGES_STORE)
        const request = store.get(channelId)

        request.onsuccess = () => {
          const cached = request.result as CachedMessages<Message> | undefined
          if (!cached) {
            resolve(null)
            return
          }

          // Check if cache is expired
          if (Date.now() - cached.cachedAt > CACHE_EXPIRY) {
            this.deleteChannelMessages(channelId)
            resolve(null)
            return
          }

          resolve({ messages: cached.messages, hasMore: cached.hasMore })
        }

        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }

  async setChannelMessages(channelId: string, messages: Message[], hasMore: boolean): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(CHANNEL_MESSAGES_STORE, 'readwrite')
        const store = transaction.objectStore(CHANNEL_MESSAGES_STORE)
        const data: CachedMessages<Message> = {
          id: channelId,
          messages,
          hasMore,
          cachedAt: Date.now(),
        }
        store.put(data)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  async deleteChannelMessages(channelId: string): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(CHANNEL_MESSAGES_STORE, 'readwrite')
        const store = transaction.objectStore(CHANNEL_MESSAGES_STORE)
        store.delete(channelId)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  async getDMMessages(dmId: string): Promise<{ messages: DMMessage[]; hasMore: boolean } | null> {
    await this.init()
    if (!this.db) return null

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(DM_MESSAGES_STORE, 'readonly')
        const store = transaction.objectStore(DM_MESSAGES_STORE)
        const request = store.get(dmId)

        request.onsuccess = () => {
          const cached = request.result as CachedMessages<DMMessage> | undefined
          if (!cached) {
            resolve(null)
            return
          }

          if (Date.now() - cached.cachedAt > CACHE_EXPIRY) {
            this.deleteDMMessages(dmId)
            resolve(null)
            return
          }

          resolve({ messages: cached.messages, hasMore: cached.hasMore })
        }

        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }

  async setDMMessages(dmId: string, messages: DMMessage[], hasMore: boolean): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(DM_MESSAGES_STORE, 'readwrite')
        const store = transaction.objectStore(DM_MESSAGES_STORE)
        const data: CachedMessages<DMMessage> = {
          id: dmId,
          messages,
          hasMore,
          cachedAt: Date.now(),
        }
        store.put(data)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  async deleteDMMessages(dmId: string): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(DM_MESSAGES_STORE, 'readwrite')
        const store = transaction.objectStore(DM_MESSAGES_STORE)
        store.delete(dmId)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  async clearAll(): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([CHANNEL_MESSAGES_STORE, DM_MESSAGES_STORE, THREAD_STORE], 'readwrite')
        transaction.objectStore(CHANNEL_MESSAGES_STORE).clear()
        transaction.objectStore(DM_MESSAGES_STORE).clear()
        transaction.objectStore(THREAD_STORE).clear()
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  async getThreadReplies(parentId: string): Promise<Message[] | null> {
    await this.init()
    if (!this.db) return null

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(THREAD_STORE, 'readonly')
        const store = transaction.objectStore(THREAD_STORE)
        const request = store.get(parentId)

        request.onsuccess = () => {
          const cached = request.result as CachedThread | undefined
          if (!cached) {
            resolve(null)
            return
          }

          // Check if cache is expired (shorter expiry for threads)
          if (Date.now() - cached.cachedAt > THREAD_CACHE_EXPIRY) {
            this.deleteThreadReplies(parentId)
            resolve(null)
            return
          }

          resolve(cached.replies)
        }

        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }

  async setThreadReplies(parentId: string, replies: Message[]): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(THREAD_STORE, 'readwrite')
        const store = transaction.objectStore(THREAD_STORE)
        const data: CachedThread = {
          id: parentId,
          replies,
          cachedAt: Date.now(),
        }
        store.put(data)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }

  async deleteThreadReplies(parentId: string): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction(THREAD_STORE, 'readwrite')
        const store = transaction.objectStore(THREAD_STORE)
        store.delete(parentId)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => resolve()
      } catch {
        resolve()
      }
    })
  }
}

export const messageCache = new MessageCacheService()
