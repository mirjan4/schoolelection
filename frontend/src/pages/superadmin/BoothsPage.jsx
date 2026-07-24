import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, Edit2, Trash2, School, ToggleLeft, ToggleRight, 
  ArrowRightLeft, AlertTriangle, CheckCircle, Info, 
  Users, TrendingUp, Search, X
} from 'lucide-react'
import { boothsAPI, electionAPI, studentsAPI } from '../../services/api'
import { useSocket } from '../../context/SocketContext'
import toast from 'react-hot-toast'
import ExportButtons from '../../components/ExportButtons'

const emptyForm = { name: '', code: '', location: '', minVoters: 10, maxVoters: 100, active: true }

export default function BoothsPage() {
  const { socket } = useSocket()
  const [booths, setBooths] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  
  // Voter Management State
  const [viewMode, setViewMode] = useState('status') // 'status' or 'allocation'
  const [stats, setStats] = useState(null)
  const [selectedBoothForTransfer, setSelectedBoothForTransfer] = useState(null)
  const [transferTargetBooth, setTransferTargetBooth] = useState(null)
  const [studentsToTransfer, setStudentsToTransfer] = useState([])
  const [searchStudent, setSearchStudent] = useState('')
  const [availableStudents, setAvailableStudents] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [transferring, setTransferring] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [bRes, sRes, stRes] = await Promise.all([
        boothsAPI.getAll(),
        electionAPI.getStats(),
        studentsAPI.getAll()
      ])
      setBooths(bRes.data.data)
      setStats(sRes.data.data)
      setAllStudents(stRes.data.data)
    } catch (err) { 
      toast.error('Failed to load booth data') 
    } finally { 
      setLoading(false) 
    }
  }, [])

  useEffect(() => { 
    fetchData() 
  }, [fetchData])

  // Realtime updates
  useEffect(() => {
    if (!socket) return
    socket.on('stats_update', fetchData)
    socket.on('booth_assignment_changed', fetchData)
    return () => {
      socket.off('stats_update')
      socket.off('booth_assignment_changed')
    }
  }, [socket, fetchData])

  const openCreate = () => { setForm(emptyForm); setEditItem(null); setShowModal(true) }
  const openEdit = (b) => { 
    setForm({ 
      name: b.name, 
      code: b.code, 
      location: b.location || '', 
      minVoters: b.minVoters || 10, 
      maxVoters: b.maxVoters || 100, 
      active: b.active 
    })
    setEditItem(b); setShowModal(true) 
  }

  const handleSave = async () => {
    if (!form.name || !form.code) return toast.error('Name and code required')
    setSaving(true)
    try {
      if (editItem) {
        await boothsAPI.update(editItem._id, form)
        toast.success('Booth updated!')
      } else {
        await boothsAPI.create(form)
        toast.success('Booth created!')
      }
      setShowModal(false)
      fetchData()
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving booth') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this booth?')) return
    try {
      await boothsAPI.delete(id)
      toast.success('Booth deleted')
      fetchData()
    } catch (err) { toast.error(err.response?.data?.message || 'Error deleting') }
  }

  const fetchBoothStudents = async (boothId) => {
    try {
      const res = await studentsAPI.getAll({ boothId })
      setAvailableStudents(res.data.data)
    } catch (err) { toast.error('Failed to load students') }
  }

  const handleTransferClick = (booth) => {
    setSelectedBoothForTransfer(booth)
    fetchBoothStudents(booth._id)
    setViewMode('allocation')
  }

  const executeTransfer = async () => {
    if (!transferTargetBooth || studentsToTransfer.length === 0) {
      return toast.error('Select target booth and at least one student')
    }
    setTransferring(true)
    try {
      await studentsAPI.transferStudents({
        studentIds: studentsToTransfer,
        targetBoothId: transferTargetBooth
      })
      toast.success('Students transferred successfully')
      setStudentsToTransfer([])
      setViewMode('status')
      fetchData()
    } catch (err) {
      toast.error('Transfer failed')
    } finally {
      setTransferring(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'overloaded': return 'text-red-400 border-red-500/30 bg-red-500/10'
      case 'near_capacity': return 'text-amber-400 border-amber-500/30 bg-amber-500/10'
      case 'underloaded': return 'text-blue-400 border-blue-500/30 bg-blue-500/10'
      default: return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Booth Management</h1>
          <p className="text-white/40 text-sm">Monitor capacity and balance voter distribution</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setViewMode('status')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'status' ? 'bg-primary-600 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Live Status
            </button>
            <button 
              onClick={() => setViewMode('allocation')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'allocation' ? 'bg-primary-600 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Voter Allocation
            </button>
          </div>
          <ExportButtons
            title="Official Booth-Wise Student List Report"
            subtitle="Complete directory of enrolled voters grouped by assigned voting booths"
            columns={[
              { header: 'Admission No', dataKey: 'admissionNo' },
              { header: 'Student Name', dataKey: 'name' },
              { header: 'Class / Section', cell: (s) => `Class ${s.class}${s.section || ''}` },
              {
                header: 'Assigned Booth',
                cell: (s) => (s.boothId?.name ? `${s.boothId.name} (${s.boothId.code})` : 'Unassigned'),
              },
              {
                header: 'Voting Status',
                cell: (s) =>
                  s.hasVotedCollege || s.hasVotedSchoolLeader || s.hasVotedClassLeader
                    ? 'Voted'
                    : 'Not Voted',
              },
            ]}
            data={[...allStudents].sort((a, b) => {
              const codeA = a.boothId?.code || 'ZZZ'
              const codeB = b.boothId?.code || 'ZZZ'
              return codeA.localeCompare(codeB)
            })}
            fileName="Booth_Wise_Student_List_Report.pdf"
          />
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Booth
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
      ) : viewMode === 'status' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stats?.boothStats?.map((bs, i) => (
            <motion.div key={bs.booth._id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`glass-card p-5 border transition-all ${bs.status === 'overloaded' ? 'border-red-500/30' : bs.status === 'near_capacity' ? 'border-amber-500/30' : 'border-white/10'}`}>
              
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bs.status === 'overloaded' ? 'bg-red-500/20 text-red-400' : 'bg-primary-500/15 text-primary-400'}`}>
                  <School size={24} />
                </div>
                <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${getStatusColor(bs.status)}`}>
                  {bs.status.replace('_', ' ')}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-white font-bold text-lg">{bs.booth.name}</h3>
                <p className="text-white/30 text-xs font-mono uppercase">{bs.booth.code} · {bs.booth.location || 'No location'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="p-3 bg-white/3 rounded-xl border border-white/5">
                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-1">Voters</p>
                  <p className="text-xl font-bold text-white">{bs.totalStudents}</p>
                  <p className="text-[10px] text-white/20 mt-1">{bs.minVoters}-{bs.maxVoters} limit</p>
                </div>
                <div className="p-3 bg-white/3 rounded-xl border border-white/5">
                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-wider mb-1">Turnout</p>
                  <p className="text-xl font-bold text-emerald-400">{bs.turnout}%</p>
                  <p className="text-[10px] text-white/20 mt-1">{bs.totalVoted} voted</p>
                </div>
              </div>

              {/* Capacity Bar */}
              <div className="space-y-1.5 mb-5">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-white/40">Capacity Load</span>
                  <span className={bs.capacityPercent > 90 ? 'text-red-400' : 'text-white/60'}>{bs.capacityPercent}%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(bs.capacityPercent, 100)}%` }}
                    className={`h-full rounded-full ${bs.status === 'overloaded' ? 'bg-red-500' : bs.status === 'near_capacity' ? 'bg-amber-500' : 'bg-primary-500'}`}
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap items-center justify-between">
                <ExportButtons
                  title="Booth Student List"
                  subtitle={`Booth: ${bs.booth.name} (${bs.booth.code})`}
                  boothDetails={{
                    name: bs.booth.name,
                    code: bs.booth.code,
                    location: bs.booth.location || 'N/A',
                  }}
                  printedBy="Super Admin"
                  columns={[
                    { header: 'Admission No', dataKey: 'admissionNo' },
                    { header: 'Student Name', dataKey: 'name' },
                    { header: 'Class', dataKey: 'class' },
                    { header: 'Section', cell: (s) => s.section || 'N/A' },
                    {
                      header: 'Voting Status',
                      cell: (s) =>
                        s.hasVotedCollege || s.hasVotedSchoolLeader || s.hasVotedClassLeader
                          ? 'Voted'
                          : 'Not Voted',
                    },
                  ]}
                  data={(() => {
                    const filteredList = allStudents.filter((s) => {
                      if (!s) return false
                      const bId = s.boothId?._id
                        ? String(s.boothId._id)
                        : s.assignedBoothId?._id
                        ? String(s.assignedBoothId._id)
                        : String(s.boothId || s.assignedBoothId || s.assignedBooth || '')
                      return bId === String(bs.booth._id)
                    })
                    console.log(
                      `[Booth Print Debug] Booth: ${bs.booth.name} (${bs.booth.code}), Total Filtered Students: ${filteredList.length}`,
                      filteredList
                    )
                    return filteredList
                  })()}
                  fileName={`Booth_${bs.booth.code}_Student_List.pdf`}
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleTransferClick(bs.booth)}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    title="Rebalance Voter Allocation"
                  >
                    <ArrowRightLeft size={14} /> Rebalance
                  </button>
                  <button 
                    onClick={() => openEdit(bs.booth)}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                    title="Edit Booth Details"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* ALLOCATION MODE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slide-up">
          {/* Source Selector */}
          <div className="lg:col-span-4 space-y-4">
            <div className="glass-card p-5">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Users size={18} className="text-primary-400" /> Source Booth
              </h3>
              <select 
                className="form-input mb-4" 
                value={selectedBoothForTransfer?._id || ''} 
                onChange={(e) => {
                  const b = booths.find(x => x._id === e.target.value)
                  setSelectedBoothForTransfer(b)
                  if (b) fetchBoothStudents(b._id)
                }}
              >
                <option value="">Select a booth to move students from...</option>
                {booths.map(b => (
                  <option key={b._id} value={b._id}>{b.name} ({stats?.boothStats?.find(s => s.booth._id === b._id)?.totalStudents} voters)</option>
                ))}
              </select>

              {selectedBoothForTransfer && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <input 
                      className="form-input pl-9 text-xs py-2" 
                      placeholder="Filter students..." 
                      value={searchStudent}
                      onChange={e => setSearchStudent(e.target.value)}
                    />
                  </div>
                  <div className="max-h-[400px] overflow-y-auto space-y-1 pr-2 scrollbar-hide">
                    {availableStudents
                      .filter(s => s.name.toLowerCase().includes(searchStudent.toLowerCase()) || s.admissionNo.includes(searchStudent))
                      .map(s => (
                        <label key={s._id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border transition-all ${studentsToTransfer.includes(s._id) ? 'bg-primary-500/10 border-primary-500/40 text-white' : 'bg-white/3 border-transparent text-white/40 hover:bg-white/5'}`}>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            checked={studentsToTransfer.includes(s._id)}
                            onChange={() => {
                              if (studentsToTransfer.includes(s._id)) {
                                setStudentsToTransfer(prev => prev.filter(id => id !== s._id))
                              } else {
                                setStudentsToTransfer(prev => [...prev, s._id])
                              }
                            }}
                          />
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${studentsToTransfer.includes(s._id) ? 'bg-primary-500 text-white' : 'bg-white/5 text-white/40'}`}>
                            {s.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold truncate">{s.name}</p>
                            <p className="text-[10px] opacity-40">{s.admissionNo} · Class {s.class}{s.section}</p>
                          </div>
                        </label>
                      ))}
                  </div>
                  <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                    <button onClick={() => setStudentsToTransfer(availableStudents.map(s => s._id))} className="text-[10px] text-primary-400 font-bold uppercase hover:underline">Select All</button>
                    <span className="text-[10px] text-white/20 font-bold">{studentsToTransfer.length} selected</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transfer Action */}
          <div className="lg:col-span-8 space-y-4">
            <div className="glass-card p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <ArrowRightLeft size={18} className="text-accent-400" /> Transfer to Destination
                </h3>
                <button onClick={() => setViewMode('status')} className="text-white/40 hover:text-white"><X size={20} /></button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto max-h-[500px] pr-2 scrollbar-hide">
                {booths.filter(b => b._id !== selectedBoothForTransfer?._id).map(b => {
                  const bStat = stats?.boothStats?.find(s => s.booth._id === b._id)
                  const isTarget = transferTargetBooth === b._id
                  return (
                    <motion.button
                      key={b._id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setTransferTargetBooth(b._id)}
                      className={`text-left p-4 rounded-2xl border transition-all ${isTarget ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/10' : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-white font-bold">{b.name}</p>
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(bStat?.status)}`}>
                          {bStat?.totalStudents} Voters
                        </div>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1 mt-3">
                        <div className="h-full rounded-full bg-primary-500/40" style={{ width: `${bStat?.capacityPercent}%` }} />
                      </div>
                      {isTarget && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mt-3 text-[10px] text-primary-400 font-bold flex items-center gap-1">
                          <CheckCircle size={12} /> Target selected
                        </motion.div>
                      )}
                    </motion.button>
                  )
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between bg-black/20 -mx-6 -mb-6 p-6">
                <div className="text-sm">
                  <p className="text-white font-bold">{studentsToTransfer.length} Students</p>
                  <p className="text-white/40 text-xs">Moving to {booths.find(b => b._id === transferTargetBooth)?.name || '...'}</p>
                </div>
                <button 
                  onClick={executeTransfer}
                  disabled={transferring || studentsToTransfer.length === 0 || !transferTargetBooth}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-accent-600 text-white font-bold shadow-lg hover:shadow-primary-500/30 disabled:opacity-30 disabled:grayscale transition-all flex items-center gap-2"
                >
                  {transferring ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <ArrowRightLeft size={18} />}
                  Confirm Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-md" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
              <h2 className="text-xl font-bold text-white mb-5">{editItem ? 'Edit Booth Settings' : 'Create New Booth'}</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/60 text-[10px] font-bold uppercase tracking-widest block mb-1">Name</label>
                    <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. 10A" />
                  </div>
                  <div>
                    <label className="text-white/60 text-[10px] font-bold uppercase tracking-widest block mb-1">Code</label>
                    <input className="form-input font-mono uppercase" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="BOOTHA" />
                  </div>
                </div>
                <div>
                  <label className="text-white/60 text-[10px] font-bold uppercase tracking-widest block mb-1">Physical Location</label>
                  <input className="form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Room 204" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/60 text-[10px] font-bold uppercase tracking-widest block mb-1">Min Voters</label>
                    <input type="number" className="form-input" value={form.minVoters} onChange={e => setForm({ ...form, minVoters: parseInt(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-white/60 text-[10px] font-bold uppercase tracking-widest block mb-1">Max Capacity</label>
                    <input type="number" className="form-input" value={form.maxVoters} onChange={e => setForm({ ...form, maxVoters: parseInt(e.target.value) })} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/3 rounded-xl border border-white/5">
                  <span className="text-white/60 text-sm font-bold">Booth Operational</span>
                  <button type="button" onClick={() => setForm({ ...form, active: !form.active })}
                    className={`transition-colors ${form.active ? 'text-emerald-400' : 'text-white/30'}`}>
                    {form.active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="flex-1 btn-ghost">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2">
                  {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
                  {editItem ? 'Update' : 'Create'}
                </button>
              </div>
              {editItem && (
                <button onClick={() => { setShowModal(false); handleDelete(editItem._id); }} className="w-full mt-4 text-red-500/50 hover:text-red-500 text-xs font-bold transition-all flex items-center justify-center gap-1.5">
                  <Trash2 size={12} /> Delete Booth Forever
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
