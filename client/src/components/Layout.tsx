import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { PlayerBar } from './PlayerBar'
import { AudioBridge } from './AudioBridge'

export function Layout() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#1c1c1c]">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <PlayerBar />
      <AudioBridge />
    </div>
  )
}
