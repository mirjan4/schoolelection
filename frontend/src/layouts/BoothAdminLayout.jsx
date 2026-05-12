import { Outlet, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Vote, LogOut, Wifi, WifiOff, School } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'

export default function BoothAdminLayout() {
  const { user, logout } = useAuth()
  const { connected } = useSocket()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 h-16 border-b border-white/5"
        style={{ background: 'rgba(6,11,20,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center glow-blue">
          <Vote size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-white font-bold leading-none text-sm">VoteFlow</h1>
          <p className="text-white/40 text-xs">Booth Admin Panel</p>
        </div>

        <div className="mx-4 h-6 w-px bg-white/10" />

        <div className="flex items-center gap-2 text-white/60 text-sm">
          <School size={15} />
          <span>{user?.boothId?.name || 'Booth'}</span>
          <span className="px-2 py-0.5 bg-white/5 rounded-md text-xs font-mono text-white/40">
            {user?.boothId?.code}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          {connected ? (
            <span className="badge-active text-xs"><span className="live-dot" />Live</span>
          ) : (
            <span className="badge-idle text-xs"><WifiOff size={10} />Offline</span>
          )}
          <div className="w-px h-5 bg-white/10" />
          <span className="text-white/60 text-sm">{user?.name}</span>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Page */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
