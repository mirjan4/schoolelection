import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, UserCheck, Play, RotateCcw, CheckCircle, Clock, Activity, QrCode } from 'lucide-react'
import { studentsAPI, electionAPI } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import toast from 'react-hot-toast'
import ExportButtons from '../../components/ExportButtons'

const STATUS_CONFIG = {
  idle: { label: 'Ready', color: 'text-white/40', bg: 'bg-white/5', icon: Clock },
  voting: { label: 'Voting in Progress', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Activity },
  completed: { label: 'Vote Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
}

export default function BoothAdminPanel() {
  const { user, boothId } = useAuth()
  const { socket } = useSocket()
  const [students, setStudents] = useState([])
  const [search, setSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [session, setSession] = useState(null)
  const [stats, setStats] = useState(null)
  const [starting, setStarting] = useState(false)
  const [resetting, setResetting] = useState(false)

  const fetchStudents = useCallback(async (q = '') => {
    if (!boothId) return
    try {
      const res = await studentsAPI.getAll({ search: q, boothId })
      setStudents(res.data.data)
    } catch (err) { console.error(err) }
  }, [boothId])

  const fetchStats = useCallback(async () => {
    try {
      const res = await electionAPI.getStats()
      setStats(res.data.data)
    } catch {}
  }, [])

  const fetchSession = useCallback(async () => {
    if (!boothId) return
    try {
      const res = await electionAPI.getSession(boothId)
      setSession(res.data.data)
    } catch {}
  }, [boothId])

  useEffect(() => {
    fetchStudents()
    fetchStats()
    fetchSession()
  }, [fetchStudents, fetchStats, fetchSession])

  // Search with debounce
  useEffect(() => {
    const t = setTimeout(() => fetchStudents(search), 300)
    return () => clearTimeout(t)
  }, [search, fetchStudents])

  // Socket events
  useEffect(() => {
    if (!socket) return
    const handlers = {
      session_update: ({ status }) => {
        setSession(prev => prev ? { ...prev, status } : null)
        if (status === 'completed' || status === 'idle') {
          fetchStudents(search)
          fetchStats()
        }
      },
      voting_completed: () => { fetchStudents(search); fetchStats() },
      session_reset: () => { setSession(null); fetchStudents(search) },
      stats_update: fetchStats,
    }
    Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn))
    return () => Object.keys(handlers).forEach(ev => socket.off(ev))
  }, [socket, fetchStudents, fetchStats, search])

  const handleStartVoting = async () => {
    if (!selectedStudent) return toast.error('Please select a student first')
    if (selectedStudent.hasVoted) {
      return toast.error('This student has already voted')
    }
    setStarting(true)
    try {
      const res = await electionAPI.startSession(selectedStudent._id)
      setSession(res.data.data)
      toast.success(`Voting started for ${selectedStudent.name}`)
      setSelectedStudent(null)
      setSearch('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start voting')
    } finally {
      setStarting(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await electionAPI.resetSession()
      setSession(null)
      toast.success('Session reset')
      fetchStudents()
    } catch { toast.error('Reset failed') }
    finally { setResetting(false) }
  }

  const currentStatus = STATUS_CONFIG[session?.status || 'idle']
  const StatusIcon = currentStatus.icon

  const votedCount = stats?.totalVoted || 0
  const totalCount = stats?.totalStudents || 0
  const turnout = totalCount > 0 ? Math.round((votedCount / totalCount) * 100) : 0

  // Students already filtered by boothId + search via API; alias for the export/list
  const displayStudents = students

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Status Banner */}
      <motion.div
        animate={{ opacity: 1 }}
        className={`flex items-center gap-4 p-4 rounded-2xl border ${session?.status === 'voting' ? 'border-blue-500/30 bg-blue-500/5' : session?.status === 'completed' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5 bg-white/3'}`}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${currentStatus.bg}`}>
          <StatusIcon size={24} className={currentStatus.color} />
        </div>
        <div className="flex-1">
          <p className={`font-bold text-lg ${currentStatus.color}`}>{currentStatus.label}</p>
          {session?.currentStudent && (
            <p className="text-white/50 text-sm">
              Student: <span className="text-white/80 font-medium">{session.currentStudent?.name || '...'}</span>
            </p>
          )}
        </div>
        {session?.status === 'voting' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/15 rounded-xl border border-blue-500/20">
            <span className="live-dot" />
            <span className="text-blue-400 text-sm font-semibold">LIVE</span>
          </div>
        )}
        {(session?.status === 'completed' || session?.status === 'voting') && (
          <button onClick={handleReset} disabled={resetting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-sm transition-all">
            <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} /> Reset
          </button>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Student selection panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Search size={16} className="text-primary-400" /> Select Student
              </h2>
              <ExportButtons
                title="Booth Student List"
                subtitle={`Booth: ${user?.boothId?.name || 'Assigned Booth'} (${user?.boothId?.code || ''})`}
                boothDetails={{
                  name: user?.boothId?.name || 'Assigned Booth',
                  code: user?.boothId?.code || 'N/A',
                  location: user?.boothId?.location || 'N/A',
                }}
                printedBy={user?.name || 'Booth Admin'}
                columns={[
                  { header: 'Admission No', dataKey: 'admissionNo' },
                  { header: 'Student Name', dataKey: 'name' },
                  { header: 'Class', dataKey: 'class' },
                  { header: 'Section', cell: (s) => s.section || 'N/A' },
                  { header: 'Voting Status', cell: (s) => (s.hasVoted ? 'Voted' : 'Not Voted') },
                ]}
                data={displayStudents}
                fileName={`Booth_${user?.boothId?.code || 'Roster'}_Student_List.pdf`}
              />
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                className="form-input pl-9 text-base"
                placeholder="Search by name or admission no..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* QR placeholder */}
            <button className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/15 text-white/30 hover:border-primary-400/30 hover:text-white/50 transition-all text-sm">
              <QrCode size={16} /> Scan QR Code (Coming Soon)
            </button>

            {/* Student list */}
            <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
              <AnimatePresence>
                {displayStudents.map(s => {
                  const hasVoted = s.hasVoted
                  const isSelected = selectedStudent?._id === s._id
                  return (
                    <motion.button
                      key={s._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => !hasVoted && setSelectedStudent(isSelected ? null : s)}
                      disabled={hasVoted}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200
                        ${hasVoted ? 'opacity-40 cursor-not-allowed border-white/10 bg-white/5' :
                          isSelected ? 'border-primary-400/60 bg-primary-500/10 shadow-lg shadow-primary-500/10' :
                          'border-white/10 hover:border-white/20 hover:bg-white/10 cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                          ${isSelected ? 'bg-primary-500 text-white' : 'bg-white/10 text-white/60'}`}>
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold truncate ${hasVoted ? 'text-white/40' : 'text-white'}`}>{s.name}</p>
                          <p className="text-white/40 text-xs">
                            {s.admissionNo} · Class {s.class}{s.section}
                          </p>
                        </div>
                        {hasVoted ? (
                          <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                        ) : isSelected ? (
                          <div className="w-4 h-4 rounded-full bg-primary-500 flex-shrink-0" />
                        ) : null}
                      </div>
                    </motion.button>
                  )
                })}
              </AnimatePresence>
              {students.length === 0 && (
                <div className="text-center py-12 text-white/30">
                  <Search size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No students found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action panel */}
        <div className="space-y-4">
          {/* Selected student */}
          <div className="glass-card p-5">
            <h3 className="text-white/60 text-sm font-medium mb-3">Selected Student</h3>
            {selectedStudent ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="flex items-center gap-3 mb-4 p-3 bg-primary-500/10 rounded-xl border border-primary-500/20">
                  <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center font-bold text-white">
                    {selectedStudent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{selectedStudent.name}</p>
                    <p className="text-white/50 text-xs">{selectedStudent.admissionNo} · Class {selectedStudent.class}{selectedStudent.section}</p>
                  </div>
                </div>
                <motion.button
                  onClick={handleStartVoting}
                  disabled={starting || session?.status === 'voting'}
                  whileTap={{ scale: 0.96 }}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-lg
                    bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400
                    text-white transition-all shadow-lg shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ boxShadow: '0 0 30px rgba(59,130,246,0.3)' }}
                >
                  {starting ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Play size={22} />}
                  START VOTING
                </motion.button>
              </motion.div>
            ) : (
              <div className="text-center py-8 text-white/25">
                <UserCheck size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a student<br />to start voting</p>
              </div>
            )}
          </div>

          {/* Booth stats */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-white/60 text-sm font-medium">Booth Statistics</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Total Students</span>
                <span className="text-white font-semibold">{totalCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Voted</span>
                <span className="text-emerald-400 font-semibold">{votedCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Pending</span>
                <span className="text-white/60 font-semibold">{totalCount - votedCount}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-white/40 mb-1">
                <span>Turnout</span><span>{turnout}%</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${turnout}%` }}
                  transition={{ duration: 1 }}
                  className="h-2 rounded-full bg-gradient-to-r from-primary-600 to-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
