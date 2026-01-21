import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAuthStore } from '../stores/authStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useDMStore } from '../stores/dmStore'

export default function Layout() {
  const { loadUser } = useAuthStore()
  const { loadWorkspaces } = useWorkspaceStore()
  const { loadDMs } = useDMStore()

  useEffect(() => {
    // Load all data in parallel for faster startup
    Promise.all([
      loadUser(),
      loadWorkspaces(),
      loadDMs(),
    ])
  }, [loadUser, loadWorkspaces, loadDMs])

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
