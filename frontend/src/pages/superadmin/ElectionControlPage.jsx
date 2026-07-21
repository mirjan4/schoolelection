import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Play, Square, Clock, AlertTriangle, CheckCircle, Activity } from 'lucide-react'
import { electionAPI } from '../../services/api'
import { useSocket } from '../../context/SocketContext'
import toast from 'react-hot-toast'

export default function ElectionControlPage() {
  const { socket } = useSocket()
  const [election, setElection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [title, setTitle] = useState('School Election 2024')
  const [electionType, setElectionType] = useState('school')

  const fetchElection = async () => {
    try {
      const res = await electionAPI.status()
      setElection(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchElection() }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('election_started', ({ election }) => setElection(election))
    socket.on('election_ended', ({ election }) => setElection(election))
    return () => {
      socket.off('election_started')
      socket.off('election_ended')
    }
  }, [socket])

  const handleStart = async () => {
    if (!confirm('Start the election? All booth devices will be activated.')) return
    setStarting(true)
    try {
      await electionAPI.start({ title, type: electionType })
      toast.success('Election started successfully!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start election')
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async () => {
    if (!confirm('Stop the election? This will end all voting sessions.')) return
    setStopping(true)
    try {
      await electionAPI.stop()
      toast.success('Election ended successfully!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to stop election')
    } finally {
      setStopping(false)
    }
  }

  const statusConfig = {
    not_started: { color: 'text-white/40', bg: 'bg-white/5', label: 'Not Started', icon: Clock },
    active: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Active', icon: Activity },
    paused: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Paused', icon: AlertTriangle },
    ended: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Ended', icon: CheckCircle },
  }

  const sc = statusConfig[election?.status] || statusConfig.not_started
  const StatusIcon = sc.icon

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Election Control</h1>
        <p className="text-white/40 text-sm mt-0.5">Start, stop, and monitor the election</p>
      </div>

      {/* Status card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${sc.bg}`}>
            <StatusIcon size={30} className={sc.color} />
          </div>
          <div>
            <p className="text-white/40 text-sm">Current Status</p>
            <h2 className={`text-3xl font-bold ${sc.color}`}>{sc.label}</h2>
          </div>
          {election?.status === 'active' && (
            <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="live-dot" />
              <span className="text-emerald-400 font-semibold text-sm">LIVE</span>
            </div>
          )}
        </div>

        {election?.startedAt && (
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-white/3 rounded-xl">
            <div>
              <p className="text-white/30 text-xs">Started At</p>
              <p className="text-white/80 text-sm font-medium">{new Date(election.startedAt).toLocaleString()}</p>
            </div>
            {election?.endedAt && (
              <div>
                <p className="text-white/30 text-xs">Ended At</p>
                <p className="text-white/80 text-sm font-medium">{new Date(election.endedAt).toLocaleString()}</p>
              </div>
            )}
            <div>
              <p className="text-white/30 text-xs">Election Type</p>
              <p className="text-white/80 text-sm font-semibold uppercase text-primary-400">
                {election.type === 'college' ? 'College Union' : 'School'}
              </p>
            </div>
            {election?.title && (
              <div className="col-span-2 mt-2 pt-2 border-t border-white/5">
                <p className="text-white/30 text-xs">Title</p>
                <p className="text-white/80 text-sm font-medium">{election.title}</p>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        {(!election || election.status === 'not_started' || election.status === 'ended') && (
          <div className="space-y-4">
            <div>
              <label className="text-white/60 text-sm font-medium block mb-1.5">Election Title</label>
              <input
                className="form-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. School Election 2024"
              />
            </div>
            <div>
              <label className="text-white/60 text-sm font-medium block mb-2">Election Type</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setElectionType('school')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    electionType === 'school'
                      ? 'border-primary-500 bg-primary-500/10 text-white shadow-lg shadow-primary-500/10'
                      : 'border-white/10 bg-white/3 text-white/50 hover:border-white/20'
                  }`}
                >
                  <p className="font-bold text-sm">School Election</p>
                  <p className="text-[11px] text-white/40 mt-1">2 votes only: Class Leader & School Leader.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setElectionType('college')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    electionType === 'college'
                      ? 'border-primary-500 bg-primary-500/10 text-white shadow-lg shadow-primary-500/10'
                      : 'border-white/10 bg-white/3 text-white/50 hover:border-white/20'
                  }`}
                >
                  <p className="font-bold text-sm">College Union Election</p>
                  <p className="text-[11px] text-white/40 mt-1">Position-based flow. Unlimited positions and custom max votes.</p>
                </button>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleStart}
              disabled={starting}
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 text-lg"
            >
              {starting ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Play size={22} />}
              Start Election
            </motion.button>
          </div>
        )}

        {election?.status === 'active' && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleStop}
            disabled={stopping}
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 text-lg"
          >
            {stopping ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Square size={22} />}
            Stop Election
          </motion.button>
        )}
      </motion.div>

      {/* Info box */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card p-6">
        <h3 className="text-white/70 font-semibold mb-3 flex items-center gap-2"><Zap size={16} className="text-primary-400" />Voting Flow</h3>
        <ol className="space-y-2 text-sm text-white/50">
          {['Booth Admin logs in and selects a student', 'Clicks START VOTING', 'Voting device instantly updates via Socket.IO', 'Student votes for Class Leader → School Leader', 'Screen auto-resets after 5 seconds', 'Booth Admin selects next student'].map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </motion.div>
    </div>
  )
}
