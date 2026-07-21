import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Vote, Eye, EyeOff, LogIn, Shield, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Please fill all fields')
    setLoading(true)
    try {
      const user = await login(email, password)
      toast.success(`Welcome, ${user.name}!`)
      navigate(user.role === 'super_admin' ? '/admin' : '/booth', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #060b14 0%, #0a0f1e 50%, #0d1b3e 100%)',
      }}>

      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent 60%)' }} />
      </div>

      {/* Animated grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Card */}
        <div className="glass-card p-8 shadow-2xl" style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(59,130,246,0.05)' }}>
          {/* Logo */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <motion.div
              animate={{ boxShadow: ['0 0 15px rgba(59,130,246,0.4)', '0 0 30px rgba(59,130,246,0.7)', '0 0 15px rgba(59,130,246,0.4)'] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center"
            >
              <Vote size={32} className="text-white" />
            </motion.div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gradient">VoteFlow</h1>
              <p className="text-white/40 text-sm mt-1">School Election Management System</p>
            </div>
          </div>



          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-white/60 text-sm font-medium block mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@election.com"
                className="form-input"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-white/60 text-sm font-medium block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input pr-12"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3.5 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <><LogIn size={18} /><span>Sign In</span></>
              )}
            </motion.button>
          </form>

          {/* Voting device link */}
          <div className="mt-6 text-center">
            <p className="text-white/30 text-xs">Setting up a voting device?</p>
            <Link to="/device" className="text-primary-400 hover:text-primary-300 text-xs font-medium transition-colors">
              Open Voting Device Setup →
            </Link>
          </div>
        </div>


      </motion.div>
    </div>
  )
}
