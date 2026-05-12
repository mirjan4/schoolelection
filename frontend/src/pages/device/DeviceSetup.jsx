import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Monitor, ArrowRight, Vote } from 'lucide-react'
import { authAPI } from '../../services/api'
import toast from 'react-hot-toast'

export default function DeviceSetup() {
  const [boothCode, setBoothCode] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSetup = async (e) => {
    e.preventDefault()
    if (!boothCode.trim()) return toast.error('Enter booth code')
    setLoading(true)
    try {
      const res = await authAPI.deviceToken(boothCode.trim())
      localStorage.setItem('device_token', res.data.token)
      localStorage.setItem('device_booth', JSON.stringify(res.data.booth))
      toast.success(`Connected to ${res.data.booth.name}`)
      navigate(`/device/${boothCode.trim().toUpperCase()}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid booth code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen kiosk-bg flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-10 text-center" style={{ border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
          <motion.div
            animate={{ boxShadow: ['0 0 20px rgba(59,130,246,0.4)', '0 0 50px rgba(59,130,246,0.7)', '0 0 20px rgba(59,130,246,0.4)'] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center mx-auto mb-6"
          >
            <Monitor size={36} className="text-white" />
          </motion.div>

          <h1 className="text-3xl font-bold text-white mb-2">Voting Device</h1>
          <p className="text-white/40 mb-8">Enter your booth code to activate this device</p>

          <form onSubmit={handleSetup} className="space-y-4">
            <input
              className="form-input text-center text-2xl font-mono tracking-widest uppercase py-4"
              placeholder="BOOTH CODE"
              value={boothCode}
              onChange={e => setBoothCode(e.target.value.toUpperCase())}
              maxLength={10}
              autoComplete="off"
            />
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-xl
                bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg transition-all
                hover:from-primary-500 hover:to-primary-400 disabled:opacity-50"
              style={{ boxShadow: '0 0 30px rgba(59,130,246,0.3)' }}
            >
              {loading
                ? <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <><Vote size={22} /> Activate Device <ArrowRight size={20} /></>
              }
            </motion.button>
          </form>

          <p className="text-white/20 text-xs mt-6">Example codes: BOOTHA · BOOTHB · BOOTHC</p>
        </div>
      </motion.div>
    </div>
  )
}
