import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import { votesAPI, candidatesAPI } from '../../services/api'
import { CheckCircle, Vote, Monitor, Wifi, WifiOff, ChevronRight } from 'lucide-react'
import confetti from 'canvas-confetti'
import toast from 'react-hot-toast'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
const PHASES = { idle: 'idle', welcome: 'welcome', class_leader: 'class_leader', school_leader: 'school_leader', confirm: 'confirm', thankyou: 'thankyou' }

export default function VotingDevice() {
  const { boothCode } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const resetTimerRef = useRef(null)

  const [connected, setConnected] = useState(false)
  const [booth, setBooth] = useState(null)
  const [phase, setPhase] = useState(PHASES.idle)
  const [student, setStudent] = useState(null)
  const [candidates, setCandidates] = useState({ class_leader: [], school_leader: [] })
  const [selections, setSelections] = useState({ class_leader: null, school_leader: null })
  const [pendingVote, setPendingVote] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(5)

  // Load booth info
  useEffect(() => {
    const saved = localStorage.getItem('device_booth')
    if (saved) setBooth(JSON.parse(saved))
    else navigate('/device')
  }, [navigate])

  // Load candidates
  useEffect(() => {
    const load = async () => {
      try {
        const res = await candidatesAPI.getAll({ active: true })
        const all = res.data.data
        setCandidates({
          class_leader: all.filter(c => c.electionType === 'class_leader'),
          school_leader: all.filter(c => c.electionType === 'school_leader'),
        })
      } catch (err) { console.error('Failed to load candidates', err) }
    }
    load()
  }, [])

  // Socket.IO connection
  useEffect(() => {
    const boothData = JSON.parse(localStorage.getItem('device_booth') || '{}')
    const boothId = boothData._id
    if (!boothId) return

    const s = io(SOCKET_URL, { transports: ['websocket'], reconnection: true })

    s.on('connect', () => {
      setConnected(true)
      s.emit('join_booth_device', { boothId })
    })
    s.on('disconnect', () => setConnected(false))

    s.on('session_state', ({ session }) => {
      if (session?.status === 'voting' && session?.currentStudent) {
        setStudent(session.currentStudent)
        setPhase(PHASES.welcome)
      }
    })

    s.on('voting_started', ({ student: s }) => {
      setStudent(s)
      setSelections({ class_leader: null, school_leader: null })
      setPhase(PHASES.welcome)
      clearTimeout(resetTimerRef.current)
    })

    s.on('session_reset', () => {
      setPhase(PHASES.idle)
      setStudent(null)
      setSelections({ class_leader: null, school_leader: null })
    })

    s.on('voting_completed', () => {
      triggerThankYou()
    })

    socketRef.current = s
    return () => { s.disconnect(); clearTimeout(resetTimerRef.current) }
  }, [])

  const triggerThankYou = useCallback(() => {
    setPhase(PHASES.thankyou)
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b'] })
    let c = 5
    setCountdown(c)
    const interval = setInterval(() => {
      c--
      setCountdown(c)
      if (c <= 0) {
        clearInterval(interval)
        setPhase(PHASES.idle)
        setStudent(null)
        setSelections({ class_leader: null, school_leader: null })
        const boothId = JSON.parse(localStorage.getItem('device_booth') || '{}')._id
        if (socketRef.current && boothId) {
          socketRef.current.emit('reset_session', { boothId })
        }
      }
    }, 1000)
  }, [])

  const selectCandidate = (type, candidateId) => {
    setSelections(prev => ({ ...prev, [type]: candidateId }))
  }

  const proceedToSchoolLeader = () => {
    if (!selections.class_leader) return toast.error('Please select a Class Leader candidate')
    setPhase(PHASES.school_leader)
  }

  const showConfirm = () => {
    if (!selections.school_leader) return toast.error('Please select a School Leader candidate')
    setPhase(PHASES.confirm)
  }

  const submitVotes = async () => {
    if (submitting) return
    setSubmitting(true)
    const boothId = JSON.parse(localStorage.getItem('device_booth') || '{}')._id
    try {
      await votesAPI.cast({ studentId: student._id, candidateId: selections.class_leader, electionType: 'class_leader', boothId })
      await votesAPI.cast({ studentId: student._id, candidateId: selections.school_leader, electionType: 'school_leader', boothId })
      if (socketRef.current) socketRef.current.emit('voting_complete', { boothId, studentId: student._id })
      triggerThankYou()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed')
      setPhase(PHASES.class_leader)
    } finally {
      setSubmitting(false)
    }
  }

  const CandidateCard = ({ candidate, selected, onSelect, big = false }) => (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={() => onSelect(candidate._id)}
      className={`kiosk-candidate-card w-full ${selected ? 'selected' : ''} ${big ? 'p-8' : 'p-5'}`}
    >
      <div className={`rounded-2xl bg-white/5 flex items-center justify-center font-bold overflow-hidden flex-shrink-0
        ${big ? 'w-28 h-28 text-5xl' : 'w-20 h-20 text-3xl'}`}>
        {candidate.photo
          ? <img src={candidate.photo} alt={candidate.name} className="w-full h-full object-cover" />
          : candidate.symbolIcon || '⭐'
        }
      </div>
      <h3 className={`text-white font-bold text-center ${big ? 'text-2xl' : 'text-lg'}`}>{candidate.name}</h3>
      <p className="text-white/50 text-sm text-center">{candidate.symbol}</p>
      {selected && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3">
          <CheckCircle size={24} className="text-primary-400" />
        </motion.div>
      )}
    </motion.button>
  )

  // ── IDLE SCREEN ──────────────────────────────────
  if (phase === PHASES.idle) return (
    <div className="min-h-screen kiosk-bg flex flex-col items-center justify-center gap-8 p-8">
      <div className="flex items-center gap-2 absolute top-6 right-6">
        {connected
          ? <span className="badge-active"><span className="live-dot" />Connected</span>
          : <span className="text-red-400 text-sm flex items-center gap-1"><WifiOff size={14} />Offline</span>}
      </div>
      <motion.div
        animate={{ scale: [1, 1.04, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center"
        style={{ boxShadow: '0 0 60px rgba(59,130,246,0.5)' }}
      >
        <Vote size={60} className="text-white" />
      </motion.div>
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-3">VoteFlow</h1>
        <p className="text-white/40 text-xl">{booth?.name || boothCode} — Voting Station</p>
      </div>
      <div className="px-8 py-4 rounded-2xl border border-white/10 bg-white/3 text-center">
        <p className="text-white/60 text-lg">Waiting for Booth Admin to assign student...</p>
        <motion.div className="flex items-center justify-center gap-2 mt-3">
          {[0, 1, 2].map(i => (
            <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
              className="w-2 h-2 bg-primary-400 rounded-full" />
          ))}
        </motion.div>
      </div>
    </div>
  )

  // ── WELCOME SCREEN ───────────────────────────────
  if (phase === PHASES.welcome) return (
    <div className="min-h-screen kiosk-bg flex flex-col items-center justify-center gap-8 p-8">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
        <div className="text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-primary-500 flex items-center justify-center mx-auto text-4xl font-bold text-white"
            style={{ boxShadow: '0 0 40px rgba(34,197,94,0.4)' }}>
            {student?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white/50 text-xl mb-2">Welcome,</p>
            <h1 className="text-5xl font-bold text-white mb-2">{student?.name}</h1>
            <p className="text-white/40 text-lg">{student?.admissionNo} · Class {student?.class}{student?.section}</p>
          </div>
          <div className="glass-card px-8 py-4 inline-block">
            <p className="text-white/60">You are about to cast your vote for:</p>
            <div className="flex gap-4 mt-3 justify-center">
              {['Class Leader', 'School Leader'].map(l => (
                <span key={l} className="px-3 py-1.5 bg-primary-500/20 border border-primary-500/30 rounded-lg text-primary-300 text-sm font-semibold">{l}</span>
              ))}
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setPhase(PHASES.class_leader)}
            className="flex items-center gap-3 mx-auto px-12 py-5 rounded-2xl text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 text-white transition-all"
            style={{ boxShadow: '0 0 40px rgba(59,130,246,0.4)' }}
          >
            Start Voting <ChevronRight size={24} />
          </motion.button>
        </div>
      </motion.div>
    </div>
  )

  // ── CLASS LEADER VOTING ──────────────────────────
  if (phase === PHASES.class_leader) return (
    <div className="min-h-screen kiosk-bg flex flex-col p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/15 border border-primary-500/20 rounded-full mb-4">
          <span className="text-primary-400 text-sm font-semibold">Step 1 of 2</span>
        </div>
        <h1 className="text-4xl font-bold text-white">Vote for Class Leader</h1>
        <p className="text-white/50 text-lg mt-2">Select your preferred candidate</p>
      </div>
      <div className={`grid gap-5 flex-1 ${candidates.class_leader.filter(c => c.class === (student?.class + student?.section)).length <= 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'} max-w-4xl mx-auto w-full`}>
        {candidates.class_leader
          .filter(c => c.class === (student?.class + student?.section))
          .map(c => (
            <CandidateCard key={c._id} candidate={c} selected={selections.class_leader === c._id} onSelect={(id) => selectCandidate('class_leader', id)} />
          ))
        }
      </div>
      <div className="mt-8 flex justify-center">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={proceedToSchoolLeader}
          disabled={!selections.class_leader}
          className="flex items-center gap-3 px-12 py-5 rounded-2xl text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          style={selections.class_leader ? { boxShadow: '0 0 40px rgba(59,130,246,0.4)' } : {}}
        >
          Next: School Leader <ChevronRight size={24} />
        </motion.button>
      </div>
    </div>
  )

  // ── SCHOOL LEADER VOTING ─────────────────────────
  if (phase === PHASES.school_leader) return (
    <div className="min-h-screen kiosk-bg flex flex-col p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-500/15 border border-accent-500/20 rounded-full mb-4">
          <span className="text-accent-400 text-sm font-semibold">Step 2 of 2</span>
        </div>
        <h1 className="text-4xl font-bold text-white">Vote for School Leader</h1>
        <p className="text-white/50 text-lg mt-2">Select your preferred candidate</p>
      </div>
      <div className={`grid gap-6 flex-1 ${candidates.school_leader.length <= 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'} max-w-5xl mx-auto w-full`}>
        {candidates.school_leader.map(c => (
          <CandidateCard key={c._id} candidate={c} big selected={selections.school_leader === c._id} onSelect={(id) => selectCandidate('school_leader', id)} />
        ))}
      </div>
      <div className="mt-8 flex justify-center">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={showConfirm}
          disabled={!selections.school_leader}
          className="flex items-center gap-3 px-12 py-5 rounded-2xl text-xl font-bold bg-gradient-to-r from-accent-600 to-accent-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          style={selections.school_leader ? { boxShadow: '0 0 40px rgba(139,92,246,0.4)' } : {}}
        >
          Review & Confirm <ChevronRight size={24} />
        </motion.button>
      </div>
    </div>
  )

  // ── CONFIRMATION SCREEN ──────────────────────────
  if (phase === PHASES.confirm) {
    const classCandidate = candidates.class_leader.find(c => c._id === selections.class_leader)
    const schoolCandidate = candidates.school_leader.find(c => c._id === selections.school_leader)
    return (
      <div className="min-h-screen kiosk-bg flex flex-col items-center justify-center p-8 gap-8">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">Confirm Your Vote</h1>
            <p className="text-white/50">Please review your selections carefully</p>
          </div>
          <div className="space-y-4">
            {[{ label: 'Class Leader', candidate: classCandidate, color: 'primary' }, { label: 'School Leader', candidate: schoolCandidate, color: 'accent' }].map(({ label, candidate, color }) => (
              <div key={label} className={`glass-card p-5 flex items-center gap-4 border ${color === 'primary' ? 'border-primary-500/30' : 'border-accent-500/30'}`}>
                <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-3xl overflow-hidden">
                  {candidate?.photo ? <img src={candidate.photo} alt={candidate.name} className="w-full h-full object-cover" /> : candidate?.symbolIcon}
                </div>
                <div className="flex-1">
                  <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-white font-bold text-xl">{candidate?.name}</p>
                  <p className="text-white/40 text-sm">{candidate?.symbol}</p>
                </div>
                <CheckCircle size={24} className={color === 'primary' ? 'text-primary-400' : 'text-accent-400'} />
              </div>
            ))}
          </div>
          <div className="flex gap-4">
            <button onClick={() => setPhase(PHASES.class_leader)}
              className="flex-1 py-4 rounded-2xl border border-white/15 text-white/60 hover:text-white hover:bg-white/5 font-semibold text-lg transition-all">
              ← Change
            </button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={submitVotes}
              disabled={submitting}
              className="flex-2 flex-1 py-4 rounded-2xl font-bold text-xl text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: '0 0 40px rgba(34,197,94,0.4)' }}
            >
              {submitting ? <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" /> : '✓ Submit Vote'}
            </motion.button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── THANK YOU SCREEN ─────────────────────────────
  if (phase === PHASES.thankyou) return (
    <div className="min-h-screen kiosk-bg flex flex-col items-center justify-center p-8 gap-8">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="text-center space-y-8"
      >
        <motion.div
          animate={{ boxShadow: ['0 0 30px rgba(34,197,94,0.5)', '0 0 80px rgba(34,197,94,0.8)', '0 0 30px rgba(34,197,94,0.5)'] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-40 h-40 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto"
        >
          <CheckCircle size={80} className="text-white" />
        </motion.div>
        <div>
          <h1 className="text-6xl font-bold text-white mb-4">Thank You!</h1>
          <p className="text-white/60 text-2xl">Your vote has been recorded successfully</p>
          <p className="text-emerald-400 text-xl mt-2 font-semibold">{student?.name}</p>
        </div>
        <div className="flex items-center justify-center gap-3 text-white/40 text-lg">
          <span>Resetting in</span>
          <motion.span
            key={countdown}
            initial={{ scale: 1.5, color: '#22c55e' }}
            animate={{ scale: 1, color: 'rgba(255,255,255,0.6)' }}
            className="text-4xl font-bold text-white"
          >{countdown}</motion.span>
          <span>seconds</span>
        </div>
      </motion.div>
    </div>
  )

  return null
}
