import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAuthStore } from '../stores/authStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useDMStore } from '../stores/dmStore'
import { useUnreadStore } from '../stores/unreadStore'
import { socketService } from '../services/socket'
import { Message, DMMessage } from '../types'

export default function Layout() {
  const { user, loadUser } = useAuthStore()
  const { loadWorkspaces, initSocketListeners } = useWorkspaceStore()
  const { loadDMs } = useDMStore()
  const { markChannelUnread, markDMUnread } = useUnreadStore()
  const location = useLocation()

  useEffect(() => {
    // Load all data in parallel for faster startup
    Promise.all([
      loadUser(),
      loadWorkspaces(),
      loadDMs(),
    ])
  }, [loadUser, loadWorkspaces, loadDMs])

  // Initialize socket listeners for workspace events
  useEffect(() => {
    const cleanup = initSocketListeners()
    return cleanup
  }, [initSocketListeners])

  // Listen for new messages and mark channels/DMs as unread
  useEffect(() => {
    const handleNewMessage = (message: Message) => {
      // Don't mark as unread if the message is from the current user
      if (message.user.id === user?.id) return

      // Don't mark as unread if no channelId
      if (!message.channelId) return

      // Don't mark as unread if currently viewing this channel
      const currentChannelId = location.pathname.match(/\/channel\/([^/]+)/)?.[1]
      if (currentChannelId === message.channelId) return

      markChannelUnread(message.channelId)
    }

    const handleNewDM = (message: DMMessage) => {
      // Don't mark as unread if the message is from the current user
      if (message.sender.id === user?.id) return

      // Don't mark as unread if currently viewing this DM
      const currentDMId = location.pathname.match(/\/dm\/([^/]+)/)?.[1]
      if (currentDMId === message.dmId) return

      markDMUnread(message.dmId)
    }

    const cleanupMessage = socketService.onNewMessage(handleNewMessage)
    const cleanupDM = socketService.onNewDM(handleNewDM)

    return () => {
      cleanupMessage()
      cleanupDM()
    }
  }, [user?.id, location.pathname, markChannelUnread, markDMUnread])

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
