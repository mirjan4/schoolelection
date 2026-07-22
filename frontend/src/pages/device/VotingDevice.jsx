import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { io } from 'socket.io-client'
import { votesAPI, candidatesAPI, electionAPI, positionsAPI } from '../../services/api'
import { CheckCircle, Vote, Monitor, Wifi, WifiOff, ChevronRight } from 'lucide-react'
import confetti from 'canvas-confetti'
import toast from 'react-hot-toast'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000'
const PHASES = {
  idle: 'idle',
  welcome: 'welcome',
  class_leader: 'class_leader',
  school_leader: 'school_leader',
  college_voting: 'college_voting',
  confirm: 'confirm',
  thankyou: 'thankyou',
}

export default function VotingDevice() {
  const { boothCode } = useParams()
  const navigate = useNavigate()
  const socketRef = useRef(null)
  const resetTimerRef = useRef(null)

  const [connected, setConnected] = useState(false)
  const [booth, setBooth] = useState(null)
  const [election, setElection] = useState(null)
  const [positions, setPositions] = useState([])
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0)

  const [phase, setPhase] = useState(PHASES.idle)
  const [student, setStudent] = useState(null)
  
  // School Mode: { class_leader: [], school_leader: [] }
  // College Mode: Array of all candidates
  const [candidates, setCandidates] = useState([])
  
  // School Mode: { class_leader: ID, school_leader: ID }
  // College Mode: { [positionId]: [candId1, candId2] }
  const [selections, setSelections] = useState({})
  
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(5)

  const isCollege = election?.type === 'college'

  // Load booth info
  useEffect(() => {
    const saved = localStorage.getItem('device_booth')
    if (saved) setBooth(JSON.parse(saved))
    else navigate('/device')
  }, [navigate])

  const loadData = useCallback(async () => {
    try {
      const [elRes, candRes] = await Promise.all([
        electionAPI.status(),
        candidatesAPI.getAll({ active: true }),
      ])
      const activeElection = elRes.data.data
      setElection(activeElection)

      const allCands = candRes.data.data
      if (activeElection?.type === 'college') {
        const posRes = await positionsAPI.getAll({ active: true })
        setPositions(posRes.data.data)
        setCandidates(allCands)
      } else {
        setCandidates({
          class_leader: allCands.filter((c) => c.electionType === 'class_leader'),
          school_leader: allCands.filter((c) => c.electionType === 'school_leader'),
        })
      }
    } catch (err) {
      console.error('Failed to load initial device data', err)
    }
  }, [])

  // Load candidates and election state
  useEffect(() => {
    loadData()
  }, [loadData])

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
        setSelections(isCollege ? {} : { class_leader: null, school_leader: null })
        setCurrentPositionIndex(0)
        setPhase(PHASES.welcome)
      }
    })

    s.on('voting_started', ({ student: s }) => {
      setStudent(s)
      setSelections(isCollege ? {} : { class_leader: null, school_leader: null })
      setCurrentPositionIndex(0)
      setPhase(PHASES.welcome)
      clearTimeout(resetTimerRef.current)
    })

    s.on('session_reset', () => {
      setPhase(PHASES.idle)
      setStudent(null)
      setSelections(isCollege ? {} : { class_leader: null, school_leader: null })
      setCurrentPositionIndex(0)
    })

    s.on('voting_completed', () => {
      triggerThankYou()
    })

    socketRef.current = s
    return () => {
      s.off()
      s.disconnect()
      clearTimeout(resetTimerRef.current)
    }
  }, [isCollege])

  const triggerThankYou = useCallback(() => {
    setPhase(PHASES.thankyou)
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b'],
    })
    let c = 5
    setCountdown(c)
    const interval = setInterval(() => {
      c--
      setCountdown(c)
      if (c <= 0) {
        clearInterval(interval)
        setPhase(PHASES.idle)
        setStudent(null)
        setSelections(isCollege ? {} : { class_leader: null, school_leader: null })
        setCurrentPositionIndex(0)
        const boothId = JSON.parse(localStorage.getItem('device_booth') || '{}')._id
        if (socketRef.current && boothId) {
          socketRef.current.emit('reset_session', { boothId })
        }
      }
    }, 1000)
  }, [isCollege])

  // Select Candidate for School Mode
  const selectCandidateSchool = (type, candidateId) => {
    setSelections((prev) => ({ ...prev, [type]: candidateId }))
  }

  // Select Candidate for College Mode
  const selectCandidateCollege = (positionId, candidateId, maxVotes) => {
    setSelections((prev) => {
      const current = prev[positionId] || []
      if (current.includes(candidateId)) {
        return { ...prev, [positionId]: current.filter((id) => id !== candidateId) }
      } else {
        if (maxVotes === 1) {
          return { ...prev, [positionId]: [candidateId] }
        } else {
          if (current.length >= maxVotes) {
            toast.error(`You can select at most ${maxVotes} candidates for this position`)
            return prev
          }
          return { ...prev, [positionId]: [...current, candidateId] }
        }
      }
    })
  }

  // School Mode Navigation
  const proceedToSchoolLeader = () => {
    if (!selections.class_leader) return toast.error('Please select a Class Leader candidate')
    setPhase(PHASES.school_leader)
  }

  const showConfirmSchool = () => {
    if (!selections.school_leader) return toast.error('Please select a School Leader candidate')
    setPhase(PHASES.confirm)
  }

  // College Mode Navigation
  const proceedCollegePosition = () => {
    const currentPos = positions[currentPositionIndex]
    const selected = selections[currentPos._id] || []
    if (selected.length === 0) {
      return toast.error(`Please select a candidate for ${currentPos.name}`)
    }
    
    if (currentPositionIndex < positions.length - 1) {
      setCurrentPositionIndex((prev) => prev + 1)
    } else {
      setPhase(PHASES.confirm)
    }
  }

  const getCollegeCandidatesForPosition = (posId) => {
    if (!Array.isArray(candidates)) return []
    return candidates.filter((c) => {
      const cPosId = c.positionId?._id || c.positionId
      return String(cPosId) === String(posId)
    })
  }

  const submitVotes = async () => {
    if (submitting) return
    setSubmitting(true)
    const boothId = JSON.parse(localStorage.getItem('device_booth') || '{}')._id
    try {
      if (isCollege) {
        // Collect all College Mode votes
        const votesToCast = []
        positions.forEach((pos) => {
          const selectedCandIds = selections[pos._id] || []
          selectedCandIds.forEach((candId) => {
            votesToCast.push({
              studentId: student._id,
              candidateId: candId,
              electionType: 'college',
              positionId: pos._id,
              boothId,
            })
          })
        })

        // Sequentially cast votes
        for (let i = 0; i < votesToCast.length; i++) {
          const votePayload = { ...votesToCast[i] }
          if (i === votesToCast.length - 1) {
            votePayload.isLastVote = true
          }
          await votesAPI.cast(votePayload)
        }
      } else {
        // Cast School Mode votes
        await votesAPI.cast({
          studentId: student._id,
          candidateId: selections.class_leader,
          electionType: 'class_leader',
          boothId,
        })
        await votesAPI.cast({
          studentId: student._id,
          candidateId: selections.school_leader,
          electionType: 'school_leader',
          boothId,
          isLastVote: true, // will trigger voted update
        })
      }

      if (socketRef.current) {
        socketRef.current.emit('voting_complete', { boothId, studentId: student._id })
      }
      triggerThankYou()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed')
      if (isCollege) {
        setPhase(PHASES.college_voting)
        setCurrentPositionIndex(0)
      } else {
        setPhase(PHASES.class_leader)
      }
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
      <div
        className={`rounded-2xl bg-white/5 flex items-center justify-center font-bold overflow-hidden flex-shrink-0
        ${big ? 'w-28 h-28 text-5xl' : 'w-20 h-20 text-3xl'}`}
      >
        {candidate.photo ? (
          <img src={candidate.photo} alt={candidate.name} className="w-full h-full object-cover" />
        ) : (
          candidate.symbolIcon || '⭐'
        )}
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
  if (phase === PHASES.idle)
    return (
      <div className="min-h-screen kiosk-bg flex flex-col items-center justify-center gap-8 p-8">
        <div className="flex items-center gap-2 absolute top-6 right-6">
          {connected ? (
            <span className="badge-active">
              <span className="live-dot" />
              Connected
            </span>
          ) : (
            <span className="text-red-400 text-sm flex items-center gap-1">
              <WifiOff size={14} />
              Offline
            </span>
          )}
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
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                className="w-2 h-2 bg-primary-400 rounded-full"
              />
            ))}
          </motion.div>
        </div>
      </div>
    )

  // ── WELCOME SCREEN ───────────────────────────────
  if (phase === PHASES.welcome)
    return (
      <div className="min-h-screen kiosk-bg flex flex-col items-center justify-center gap-8 p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <div className="text-center space-y-6">
            <div
              className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-primary-500 flex items-center justify-center mx-auto text-4xl font-bold text-white"
              style={{ boxShadow: '0 0 40px rgba(34,197,94,0.4)' }}
            >
              {student?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white/50 text-xl mb-2">Welcome,</p>
              <h1 className="text-5xl font-bold text-white mb-2">{student?.name}</h1>
              <p className="text-white/40 text-lg">
                {student?.admissionNo} · Class {student?.class}
                {student?.section}
              </p>
            </div>
            <div className="glass-card px-8 py-4 inline-block">
              <p className="text-white/60">You are about to cast your vote for:</p>
              <div className="flex gap-4 mt-3 justify-center">
                {isCollege ? (
                  positions.map((pos) => (
                    <span
                      key={pos._id}
                      className="px-3 py-1.5 bg-primary-500/20 border border-primary-500/30 rounded-lg text-primary-300 text-sm font-semibold"
                    >
                      {pos.name}
                    </span>
                  ))
                ) : (
                  ['Class Leader', 'School Leader'].map((l) => (
                    <span
                      key={l}
                      className="px-3 py-1.5 bg-primary-500/20 border border-primary-500/30 rounded-lg text-primary-300 text-sm font-semibold"
                    >
                      {l}
                    </span>
                  ))
                )}
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (isCollege) {
                  setPhase(PHASES.college_voting)
                  setCurrentPositionIndex(0)
                } else {
                  setPhase(PHASES.class_leader)
                }
              }}
              className="flex items-center gap-3 mx-auto px-12 py-5 rounded-2xl text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 text-white transition-all"
              style={{ boxShadow: '0 0 40px rgba(59,130,246,0.4)' }}
            >
              Start Voting <ChevronRight size={24} />
            </motion.button>
          </div>
        </motion.div>
      </div>
    )

  // ── SCHOOL: CLASS LEADER VOTING ──────────────────────────
  if (phase === PHASES.class_leader) {
    const list = candidates.class_leader?.filter(
      (c) => c.class === student?.class + student?.section
    ) || []
    return (
      <div className="min-h-screen kiosk-bg flex flex-col p-4 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 sm:py-2 bg-primary-500/15 border border-primary-500/20 rounded-full mb-3 sm:mb-4">
            <span className="text-primary-400 text-xs sm:text-sm font-semibold">Step 1 of 2</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-white">Vote for Class Leader</h1>
          <p className="text-white/50 text-sm sm:text-lg mt-1 sm:mt-2">Select your preferred candidate</p>
        </div>
        <div
          className={`grid gap-4 sm:gap-5 flex-1 ${
            list.length <= 3 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          } max-w-4xl mx-auto w-full`}
        >
          {list.map((c) => (
            <CandidateCard
              key={c._id}
              candidate={c}
              selected={selections.class_leader === c._id}
              onSelect={(id) => selectCandidateSchool('class_leader', id)}
            />
          ))}
        </div>
        <div className="mt-6 sm:mt-8 flex justify-center">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={proceedToSchoolLeader}
            disabled={!selections.class_leader}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 sm:px-12 py-4 sm:py-5 rounded-2xl text-lg sm:text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all min-h-[52px]"
            style={selections.class_leader ? { boxShadow: '0 0 40px rgba(59,130,246,0.4)' } : {}}
          >
            Next: School Leader <ChevronRight size={24} />
          </motion.button>
        </div>
      </div>
    )
  }

  // ── SCHOOL: SCHOOL LEADER VOTING ─────────────────────────
  if (phase === PHASES.school_leader) {
    const list = candidates.school_leader || []
    return (
      <div className="min-h-screen kiosk-bg flex flex-col p-4 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 sm:py-2 bg-accent-500/15 border border-accent-500/20 rounded-full mb-3 sm:mb-4">
            <span className="text-accent-400 text-xs sm:text-sm font-semibold">Step 2 of 2</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-white">Vote for School Leader</h1>
          <p className="text-white/50 text-sm sm:text-lg mt-1 sm:mt-2">Select your preferred candidate</p>
        </div>
        <div
          className={`grid gap-4 sm:gap-6 flex-1 ${
            list.length <= 3 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          } max-w-5xl mx-auto w-full`}
        >
          {list.map((c) => (
            <CandidateCard
              key={c._id}
              candidate={c}
              big
              selected={selections.school_leader === c._id}
              onSelect={(id) => selectCandidateSchool('school_leader', id)}
            />
          ))}
        </div>
        <div className="mt-6 sm:mt-8 flex justify-center">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={showConfirmSchool}
            disabled={!selections.school_leader}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 sm:px-12 py-4 sm:py-5 rounded-2xl text-lg sm:text-xl font-bold bg-gradient-to-r from-accent-600 to-accent-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all min-h-[52px]"
            style={selections.school_leader ? { boxShadow: '0 0 40px rgba(139,92,246,0.4)' } : {}}
          >
            Review & Confirm <ChevronRight size={24} />
          </motion.button>
        </div>
      </div>
    )
  }

  // ── COLLEGE: DYNAMIC POSITION-WISE VOTING ────────────────
  if (phase === PHASES.college_voting) {
    const currentPos = positions[currentPositionIndex]
    if (!currentPos) return null

    const list = getCollegeCandidatesForPosition(currentPos._id)
    const selectedList = selections[currentPos._id] || []

    return (
      <div className="min-h-screen kiosk-bg flex flex-col p-4 sm:p-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 sm:py-2 bg-primary-500/15 border border-primary-500/20 rounded-full mb-3 sm:mb-4">
            <span className="text-primary-400 text-xs sm:text-sm font-semibold">
              Step {currentPositionIndex + 1} of {positions.length}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-white">Vote for {currentPos.name}</h1>
          <p className="text-white/50 text-sm sm:text-lg mt-1 sm:mt-2">
            Select {currentPos.maxVotes === 1 ? 'your preferred candidate' : `up to ${currentPos.maxVotes} candidates`}
          </p>
        </div>
        <div
          className={`grid gap-4 sm:gap-5 flex-1 ${
            list.length <= 3 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          } max-w-4xl mx-auto w-full`}
        >
          {list.map((c) => (
            <CandidateCard
              key={c._id}
              candidate={c}
              selected={selectedList.includes(c._id)}
              onSelect={(id) => selectCandidateCollege(currentPos._id, id, currentPos.maxVotes)}
            />
          ))}
          {list.length === 0 && (
            <div className="col-span-full flex items-center justify-center text-white/30 text-base sm:text-lg py-12">
              No candidates registered for this position.
            </div>
          )}
        </div>
        <div className="mt-6 sm:mt-8 flex justify-center">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={proceedCollegePosition}
            disabled={list.length > 0 && selectedList.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 sm:px-12 py-4 sm:py-5 rounded-2xl text-lg sm:text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all min-h-[52px]"
            style={selectedList.length > 0 || list.length === 0 ? { boxShadow: '0 0 40px rgba(59,130,246,0.4)' } : {}}
          >
            {currentPositionIndex < positions.length - 1 ? (
              <>
                Next: {positions[currentPositionIndex + 1]?.name} <ChevronRight size={24} />
              </>
            ) : (
              <>
                Review & Confirm <ChevronRight size={24} />
              </>
            )}
          </motion.button>
        </div>
      </div>
    )
  }

  // ── CONFIRMATION SCREEN ──────────────────────────
  if (phase === PHASES.confirm) {
    if (isCollege) {
      // Collect all selected candidates grouped by position
      const confirmItems = positions.map((pos) => {
        const selectedCandIds = selections[pos._id] || []
        const cands = getCollegeCandidatesForPosition(pos._id).filter((c) =>
          selectedCandIds.includes(c._id)
        )
        return {
          position: pos,
          candidates: cands,
        }
      })

      return (
        <div className="min-h-screen kiosk-bg flex flex-col items-center justify-center p-4 sm:p-8 gap-6 sm:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl space-y-4 sm:space-y-6"
          >
            <div className="text-center">
              <h1 className="text-2xl sm:text-4xl font-bold text-white mb-1.5 sm:mb-2">Confirm Your Votes</h1>
              <p className="text-white/50 text-xs sm:text-base">Please review your selections carefully before submitting</p>
            </div>
            <div className="space-y-3 sm:space-y-4 max-h-[45vh] sm:max-h-[50vh] overflow-y-auto pr-1 sm:pr-2 scrollbar-hide">
              {confirmItems.map(({ position, candidates }) => (
                <div key={position._id} className="glass-card p-3 sm:p-4 border border-white/10 space-y-2">
                  <p className="text-primary-400 text-xs font-bold uppercase tracking-wider">
                    {position.name}
                  </p>
                  {candidates.length > 0 ? (
                    <div className="space-y-2">
                      {candidates.map((candidate) => (
                        <div key={candidate._id} className="flex items-center gap-3 bg-white/3 p-2.5 rounded-lg border border-white/5">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white/5 flex items-center justify-center text-xl sm:text-2xl overflow-hidden shrink-0">
                            {candidate.photo ? (
                              <img
                                src={candidate.photo}
                                alt={candidate.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              candidate.symbolIcon
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-sm sm:text-base truncate">{candidate.name}</p>
                            <p className="text-white/40 text-xs truncate">{candidate.symbol}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white/30 text-xs italic">Skipped / No candidate selected</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={() => {
                  setPhase(PHASES.college_voting)
                  setCurrentPositionIndex(0)
                }}
                className="w-full sm:flex-1 py-3.5 sm:py-4 rounded-2xl border border-white/15 text-white/60 hover:text-white hover:bg-white/5 font-semibold text-base sm:text-lg transition-all min-h-[48px]"
              >
                ← Change Selections
              </button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={submitVotes}
                disabled={submitting}
                className="flex-2 flex-1 py-4 rounded-2xl font-bold text-xl text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  boxShadow: '0 0 40px rgba(34,197,94,0.4)',
                }}
              >
                {submitting ? (
                  <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                ) : (
                  '✓ Submit Votes'
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )
    } else {
      // School Mode confirmation
      const classCandidate = candidates.class_leader?.find(
        (c) => c._id === selections.class_leader
      )
      const schoolCandidate = candidates.school_leader?.find(
        (c) => c._id === selections.school_leader
      )
      return (
        <div className="min-h-screen kiosk-bg flex flex-col items-center justify-center p-8 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg space-y-6"
          >
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white mb-2">Confirm Your Vote</h1>
              <p className="text-white/50">Please review your selections carefully</p>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Class Leader', candidate: classCandidate, color: 'primary' },
                { label: 'School Leader', candidate: schoolCandidate, color: 'accent' },
              ].map(({ label, candidate, color }) => (
                <div
                  key={label}
                  className={`glass-card p-5 flex items-center gap-4 border ${
                    color === 'primary' ? 'border-primary-500/30' : 'border-accent-500/30'
                  }`}
                >
                  <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-3xl overflow-hidden">
                    {candidate?.photo ? (
                      <img
                        src={candidate.photo}
                        alt={candidate.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      candidate?.symbolIcon
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-0.5">
                      {label}
                    </p>
                    <p className="text-white font-bold text-xl">{candidate?.name}</p>
                    <p className="text-white/40 text-sm">{candidate?.symbol}</p>
                  </div>
                  <CheckCircle size={24} className={color === 'primary' ? 'text-primary-400' : 'text-accent-400'} />
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setPhase(PHASES.class_leader)}
                className="flex-1 py-4 rounded-2xl border border-white/15 text-white/60 hover:text-white hover:bg-white/5 font-semibold text-lg transition-all"
              >
                ← Change
              </button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={submitVotes}
                disabled={submitting}
                className="flex-2 flex-1 py-4 rounded-2xl font-bold text-xl text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  boxShadow: '0 0 40px rgba(34,197,94,0.4)',
                }}
              >
                {submitting ? (
                  <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                ) : (
                  '✓ Submit Vote'
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )
    }
  }

  // ── THANK YOU SCREEN ─────────────────────────────
  if (phase === PHASES.thankyou)
    return (
      <div className="min-h-screen kiosk-bg flex flex-col items-center justify-center p-8 gap-8">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center space-y-8"
        >
          <motion.div
            animate={{
              boxShadow: [
                '0 0 30px rgba(34,197,94,0.5)',
                '0 0 80px rgba(34,197,94,0.8)',
                '0 0 30px rgba(34,197,94,0.5)',
              ],
            }}
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
            >
              {countdown}
            </motion.span>
            <span>seconds</span>
          </div>
        </motion.div>
      </div>
    )

  return null
}
