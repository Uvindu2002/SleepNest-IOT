import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/overview',   icon: '🏠', label: 'Overview' },
  { to: '/monitoring', icon: '📊', label: 'Monitoring' },
  { to: '/sleep',      icon: '💤', label: 'Sleep' },
  { to: '/alerts',     icon: '🔔', label: 'Alerts' },
  { to: '/history',    icon: '📋', label: 'History' },
  { to: '/babysitter', icon: '👁️', label: 'Baby Sitter View' },
  { to: '/settings',   icon: '⚙️', label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-[210px] bg-white dark:bg-[#161928] border-r border-nest-border dark:border-[#2A2E4A] flex flex-col z-20 transition-colors">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2 px-4 py-6 border-b border-nest-border dark:border-[#2A2E4A]">
        <div className="w-[58px] h-[58px] rounded-full bg-gradient-to-br from-nest-green to-accent-light flex items-center justify-content-center justify-center text-2xl shadow-md">
          🌿
        </div>
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100 tracking-tight">
          SleepNest
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-accent-nav text-white shadow shadow-green-200 dark:shadow-none'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-nest-cream dark:hover:bg-[#1E2236] hover:text-gray-800 dark:hover:text-gray-100'
              }`
            }
          >
            <span className="text-[1rem] w-5 text-center flex-shrink-0">{icon}</span>
            <span className="leading-none">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
