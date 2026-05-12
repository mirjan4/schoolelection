import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Vote, Users, School, UserCog,
  BarChart3, Settings, LogOut, Menu, X, Zap, Wifi, WifiOff
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/election', label: 'Election Control', icon: Zap },
  { to: '/admin/booths', label: 'Booths', icon: School },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/candidates', label: 'Candidates', icon: Vote },
  { to: '/admin/users', label: 'Booth Admins', icon: UserCog },
  { to: '/admin/results', label: 'Results', icon: BarChart3 },
]

export default function SuperAdminLayout() {
  const { user, logout } = useAuth()
  const { connected } = useSocket()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex min-h-screen bg-navy-950">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 h-full w-64 z-50 flex flex-col"
            style={{
              background: 'linear-gradient(180deg, rgba(10,15,30,0.98) 0%, rgba(6,11,20,0.98) 100%)',
              borderRight: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg glow-blue">
                <Vote size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-none">VoteFlow</h1>
                <p className="text-white/40 text-xs mt-0.5">Election System</p>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'active' : ''}`
                  }
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-white/5 space-y-3">
              {/* Connection status */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${connected ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {connected ? 'Connected' : 'Disconnected'}
                {connected && <span className="live-dot ml-auto" />}
              </div>
              {/* User info */}
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-xs font-bold">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-white/40 text-xs">Super Admin</p>
                </div>
                <button onClick={handleLogout} className="text-white/30 hover:text-red-400 transition-colors p-1" title="Logout">
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center gap-4 px-6 h-16 border-b border-white/5"
          style={{ background: 'rgba(6,11,20,0.85)', backdropFilter: 'blur(12px)' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white/50 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="badge-active"><span className="live-dot" />Live</span>
            ) : (
              <span className="badge-idle"><WifiOff size={10} />Offline</span>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
