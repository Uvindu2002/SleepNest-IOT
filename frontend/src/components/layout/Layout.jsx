import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar  from './Topbar'

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-nest-bg dark:bg-[#0D0F1A] transition-colors">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0" style={{ marginLeft: 210 }}>
        <Topbar />
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
