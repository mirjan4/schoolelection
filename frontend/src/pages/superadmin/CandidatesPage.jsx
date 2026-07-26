import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, Trophy, Star, ShieldAlert, BookOpen, Layers, Upload } from 'lucide-react'
import { candidatesAPI, electionAPI, positionsAPI, studentsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import ExportButtons from '../../components/ExportButtons'

const emptyForm = {
  name: '',
  symbol: '',
  symbolIcon: '⭐',
  symbolType: 'icon',
  symbolImage: '',
  electionType: 'school_leader',
  positionId: '',
  department: '',
  year: '',
  class: '',
  description: '',
  active: true,
}

const ICONS = [
  // Objects & Items
  '⭐', '🌸', '📷', '🏆', '🏏', '📖', '📱', '🖊️', '🪑', '💻',
  '👜', '💡', '⚽', '🍃', '🔑', '🕒', '👓', '🚲', '☀️', '🎈',
  // Nature & Symbols
  '🌳', '🪁', '☂️', '👑', '🎯', '💎', '🏅', '🎖️',
  // Animals
  '🎒', '🐘', '🍵', '🐅', '🕊️', '🐬', '🦋',
  // Plants & Elements
  '🌴', '🌲', '🌻', '🌙', '⚡', '🔥',
]

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([])
  const [positions, setPositions] = useState([])
  const [students, setStudents] = useState([])
  const [election, setElection] = useState(null)
  const [configuredType, setConfiguredType] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [photoFile, setPhotoFile] = useState(null)
  const [symbolImageFile, setSymbolImageFile] = useState(null)
  const [symbolImagePreview, setSymbolImagePreview] = useState('')
  const [saving, setSaving] = useState(false)

  // Student Search Dropdown States
  const [studentSearch, setStudentSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const fetchData = async () => {
    try {
      const [cRes, bRes, eRes, sRes] = await Promise.all([
        candidatesAPI.getAll({ _t: Date.now() }), // cache-buster: always fetch fresh list
        positionsAPI.getAll({ active: true }),
        electionAPI.status(),
        studentsAPI.getAll(),
      ])
      setCandidates(cRes.data.data)
      setPositions(bRes.data.data)
      setStudents(sRes.data.data)
      const activeElection = eRes.data.data
      setElection(activeElection)
      setConfiguredType(activeElection?.type || 'college')
    } catch {
      toast.error('Failed to load candidates data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const isCollege = (election?.status === 'active' ? election?.type : (configuredType || 'college')) === 'college'

  // Filter candidates for School Mode
  const schoolLeaders = candidates.filter((c) => c.electionType === 'school_leader')
  const classLeaders = candidates.filter((c) => c.electionType === 'class_leader')

  // Group candidates for College Mode (by position name)
  const groupedCollegeCandidates = positions.reduce((acc, pos) => {
    acc[pos._id] = {
      position: pos,
      list: candidates.filter((c) => c.positionId && (c.positionId._id || c.positionId) === pos._id),
    }
    return acc;
  }, {})

  // Sort candidates within position groups (by displayOrder ASC, then name ASC)
  const sortCandidatesInGroup = (list) => {
    return [...list].sort((a, b) => {
      const orderA = a.displayOrder !== undefined && a.displayOrder !== null ? a.displayOrder : 0
      const orderB = b.displayOrder !== undefined && b.displayOrder !== null ? b.displayOrder : 0
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  }

  // Construct position-grouped data for Candidate Print Report (in Position displayOrder ASC)
  const groupedCandidateReportData = isCollege
    ? positions
        .map((pos) => {
          const rawList = groupedCollegeCandidates[pos._id]?.list || []
          return {
            groupTitle: pos.name,
            items: sortCandidatesInGroup(rawList),
          }
        })
        .filter((g) => g.items.length > 0)
    : [
        {
          groupTitle: 'SCHOOL LEADER',
          items: sortCandidatesInGroup(schoolLeaders),
        },
        {
          groupTitle: 'CLASS LEADER',
          items: sortCandidatesInGroup(classLeaders),
        },
      ].filter((g) => g.items.length > 0)

  const openCreate = () => {
    setForm({
      ...emptyForm,
      electionType: isCollege ? 'college_position' : 'school_leader',
      positionId: positions[0]?._id || '',
    })
    setPhotoFile(null)
    setSymbolImageFile(null)
    setSymbolImagePreview('')
    setEditItem(null)
    setStudentSearch('')
    setShowDropdown(false)
    setShowModal(true)
  }

  const openEdit = (c) => {
    setForm({
      name: c.name,
      symbol: c.symbol,
      symbolIcon: c.symbolIcon || '⭐',
      symbolType: c.symbolType || 'icon',
      symbolImage: c.symbolImage || '',
      electionType: c.electionType || (isCollege ? 'college_position' : 'school_leader'),
      positionId: c.positionId?._id || c.positionId || '',
      department: c.department || '',
      year: c.year || '',
      class: c.class || '',
      description: c.description || '',
      active: c.active,
    })
    setPhotoFile(null)
    setSymbolImageFile(null)
    setSymbolImagePreview(c.symbolImage || '')
    setEditItem(c)
    setStudentSearch(c.name)
    setShowDropdown(false)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name required')
    if (isCollege && !form.positionId) return toast.error('Please select a Position')
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (photoFile) fd.append('photo', photoFile)
      if (symbolImageFile && form.symbolType === 'image') fd.append('symbolImage', symbolImageFile)

      if (editItem) {
        await candidatesAPI.update(editItem._id, fd)
        toast.success('Candidate updated successfully!')
      } else {
        await candidatesAPI.create(fd)
        toast.success('Candidate created successfully!')
      }
      setShowModal(false)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving candidate')
    } finally {
      setSaving(false)
    }
  }

  const handleSymbolImageSelect = (file) => {
    if (!file) return
    setSymbolImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setSymbolImagePreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleSymbolImageDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleSymbolImageSelect(file)
  }

  const removeSymbolImage = () => {
    setSymbolImageFile(null)
    setSymbolImagePreview('')
    setForm({ ...form, symbolImage: '' })
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this candidate?')) return
    try {
      // Optimistic update: remove from state immediately so print report stays in sync
      setCandidates(prev => prev.filter(c => c._id !== id))
      await candidatesAPI.delete(id)
      toast.success('Candidate deleted successfully')
      fetchData() // re-sync with server to confirm
    } catch {
      toast.error('Failed to delete candidate')
      fetchData() // revert optimistic update on failure
    }
  }

  const CandidateCard = ({ c }) => (
    <div className="glass-card p-4 hover:border-white/20 transition-all flex flex-col justify-between">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
          {c.photo ? (
            <img src={c.photo} alt={c.name} className="w-full h-full object-cover" />
          ) : c.symbolType === 'image' && c.symbolImage ? (
            <img src={c.symbolImage} alt={c.symbol} className="w-full h-full object-contain p-1" />
          ) : (
            c.symbolIcon || '⭐'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold truncate text-base">{c.name}</h3>
          <p className="text-white/70 text-xs font-medium truncate flex items-center gap-1.5 mt-0.5">
            {c.symbolType === 'image' && c.symbolImage ? (
              <img src={c.symbolImage} alt={c.symbol} className="w-4 h-4 object-contain rounded" />
            ) : c.symbolIcon ? (
              <span className="text-sm">{c.symbolIcon}</span>
            ) : null}
            <span>{c.symbol}</span>
          </p>
          {isCollege ? (
            <div className="text-[10px] text-white/50 space-y-0.5 mt-1">
              {c.department && <p>Dept: {c.department}</p>}
              {c.year && <p>Year: {c.year} | Class: {c.class}</p>}
            </div>
          ) : (
            c.electionType === 'class_leader' && (
              <span className="text-[10px] px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-white/50 mt-1 inline-block">
                Class {c.class}
              </span>
            )
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => openEdit(c)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => handleDelete(c._id)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {c.description && (
        <p className="text-xs text-white/40 border-t border-white/5 mt-3 pt-2 line-clamp-2 italic">
          "{c.description}"
        </p>
      )}
      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] px-2 py-0.5 bg-primary-500/15 text-primary-400 rounded-full border border-primary-500/20">
          {c.voteCount} votes
        </span>
        <span
          className={`text-[9px] font-semibold px-2 py-0.5 rounded ${
            c.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}
        >
          {c.active ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Candidates</h1>
          <p className="text-white/40 text-sm">
            {candidates.length} candidates registered · Configuration Mode:{' '}
            <strong className="text-primary-400 font-bold uppercase">
              {isCollege ? 'College Union' : 'School'}
            </strong>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {election?.status !== 'active' && (
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setConfiguredType('school')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !isCollege
                    ? 'bg-primary-500 text-white shadow'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                School Ballots
              </button>
              <button
                onClick={() => setConfiguredType('college')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isCollege
                    ? 'bg-primary-500 text-white shadow'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                College Ballots
              </button>
            </div>
          )}
          <ExportButtons
            title="Registered Candidates Report"
            subtitle={isCollege ? 'College Union Election' : 'School Election'}
            columns={[
              { header: 'Candidate Name', dataKey: 'name' },
              {
                header: 'Symbol / Party',
                cell: (c) =>
                  c.symbolType === 'image' && c.symbolImage ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <img
                        src={c.symbolImage}
                        alt={c.symbol}
                        style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '3px', verticalAlign: 'middle' }}
                      />
                      <span>{c.symbol || ''}</span>
                    </span>
                  ) : (
                    `${c.symbolIcon || ''} ${c.symbol || ''}`.trim() || 'N/A'
                  ),
              },
              {
                header: 'Dept / Class',
                cell: (c) =>
                  isCollege
                    ? c.department
                      ? `${c.department}${c.year ? ` (Year ${c.year})` : ''}`
                      : c.class || 'N/A'
                    : `Class ${c.class}`,
              },
              { header: 'Vote Count', dataKey: 'voteCount' },
            ]}
            data={candidates}
            groupedData={groupedCandidateReportData}
            fileName="Candidates_Roster_Report.pdf"
          />
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 flex-shrink-0">
            <Plus size={18} /> Add Candidate
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : isCollege ? (
        // College Mode Candidates Rendering
        <div className="space-y-8">
          {positions.map((pos) => {
            const list = groupedCollegeCandidates[pos._id]?.list || []
            return (
              <div key={pos._id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/5"></span>
                  <span className="text-xs font-bold tracking-wider text-white/30 uppercase bg-white/5 px-4 py-1.5 rounded-full border border-white/5 flex items-center gap-1.5">
                    <Layers size={12} className="text-primary-400" />
                    {pos.name} ({list.length})
                  </span>
                  <span className="h-px flex-1 bg-white/5"></span>
                </div>
                {list.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map((c) => (
                      <CandidateCard key={c._id} c={c} />
                    ))}
                  </div>
                ) : (
                  <p className="text-white/20 text-xs text-center py-6">No candidates in this position yet</p>
                )}
              </div>
            )
          })}
          {positions.length === 0 && (
            <div className="text-center py-12 glass-card border-dashed">
              <ShieldAlert size={32} className="mx-auto text-amber-400/40 mb-2" />
              <p className="text-white/40 text-sm">Please define active positions before adding candidates</p>
            </div>
          )}
        </div>
      ) : (
        // School Mode Candidates Rendering
        <div className="space-y-6">
          <div>
            <h2 className="text-white/70 font-semibold mb-3 flex items-center gap-2">
              <Trophy size={16} className="text-gold-400" /> School Leader ({schoolLeaders.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {schoolLeaders.map((c) => (
                <CandidateCard key={c._id} c={c} />
              ))}
              {!schoolLeaders.length && (
                <p className="text-white/30 text-sm py-6">No school leader candidates</p>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-white/70 font-semibold mb-6 flex items-center gap-2">
              <Star size={16} className="text-primary-400" /> Class Leader ({classLeaders.length})
            </h2>

            <div className="space-y-8">
              {Object.entries(
                classLeaders.reduce((acc, c) => {
                  const cls = c.class || 'Unassigned'
                  if (!acc[cls]) acc[cls] = []
                  acc[cls].push(c)
                  return acc
                }, {})
              )
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([cls, list]) => (
                  <div key={cls} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-white/5"></span>
                      <span className="text-xs font-black tracking-widest text-white/20 uppercase bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        Class {cls}
                      </span>
                      <span className="h-px flex-1 bg-white/5"></span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {list.map((c) => (
                        <CandidateCard key={c._id} c={c} />
                      ))}
                    </div>
                  </div>
                ))}
              {classLeaders.length === 0 && (
                <p className="text-white/30 text-sm py-6">No class leader candidates</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <h2 className="text-xl font-bold text-white mb-4">
                {editItem ? 'Edit' : 'Add'} Candidate ({isCollege ? 'College' : 'School'} Mode)
              </h2>
              <div className="space-y-3">
                {isCollege ? (
                  <div>
                    <label className="text-white/60 text-sm block mb-1">Position *</label>
                    <select
                      className="form-input"
                      value={form.positionId}
                      onChange={(e) => setForm({ ...form, positionId: e.target.value })}
                    >
                      {positions.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-white/60 text-sm block mb-1">Election Type</label>
                    <select
                      className="form-input"
                      value={form.electionType}
                      onChange={(e) => setForm({ ...form, electionType: e.target.value })}
                    >
                      <option value="school_leader">School Leader</option>
                      <option value="class_leader">Class Leader</option>
                    </select>
                  </div>
                )}

                <div className="relative">
                  <label className="text-white/60 text-sm block mb-1">Name *</label>
                  <input
                    className="form-input"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value)
                      setForm({ ...form, name: e.target.value })
                      setShowDropdown(true)
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search student by name or admission..."
                  />
                  
                  {showDropdown && (
                    <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                  )}

                  {showDropdown && studentSearch.trim().length > 0 && (
                    <div 
                      className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-navy-900 border border-white/10 rounded-xl z-50 shadow-2xl scrollbar-hide"
                    >
                      {students
                        .filter(s =>
                          s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                          s.admissionNo.toLowerCase().includes(studentSearch.toLowerCase())
                        )
                        .slice(0, 10)
                        .map(s => (
                          <button
                            key={s._id}
                            type="button"
                            onClick={() => {
                              setForm({
                                ...form,
                                name: s.name,
                                class: isCollege ? s.class : (s.class + s.section),
                              })
                              setStudentSearch(s.name)
                              setShowDropdown(false)
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-xs text-white/80 transition-all flex items-center justify-between border-b border-white/5 last:border-0"
                          >
                            <span>{s.name} ({s.class}{s.section})</span>
                            <span className="font-mono text-[9px] text-white/30">{s.admissionNo}</span>
                          </button>
                        ))}
                      {students.filter(s =>
                        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                        s.admissionNo.toLowerCase().includes(studentSearch.toLowerCase())
                      ).length === 0 && (
                        <p className="text-white/30 text-[10px] text-center py-3">No matching students found</p>
                      )}
                    </div>
                  )}
                </div>

                {isCollege && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-white/60 text-sm block mb-1">Department</label>
                      <input
                        className="form-input"
                        value={form.department}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                        placeholder="e.g. CS"
                      />
                    </div>
                    <div>
                      <label className="text-white/60 text-sm block mb-1">Year</label>
                      <input
                        className="form-input"
                        value={form.year}
                        onChange={(e) => setForm({ ...form, year: e.target.value })}
                        placeholder="e.g. S1 / S2"
                      />
                    </div>
                  </div>
                )}

                {(isCollege || form.electionType === 'class_leader') && (
                  <div>
                    <label className="text-white/60 text-sm block mb-1">
                      Class {isCollege ? '(Optional)' : '*'}
                    </label>
                    <input
                      className="form-input"
                      value={form.class}
                      onChange={(e) => setForm({ ...form, class: e.target.value.toUpperCase() })}
                      placeholder="e.g. 10A"
                    />
                  </div>
                )}

                <div>
                  <label className="text-white/60 text-sm block mb-1">Symbol Name</label>
                  <input
                    className="form-input"
                    value={form.symbol}
                    onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                    placeholder="e.g. Rising Star"
                  />
                </div>

                <div>
                  <label className="text-white/60 text-sm font-semibold block mb-2">Symbol Icon</label>

                  {/* Radio Toggle */}
                  <div className="flex gap-3 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="symbolType"
                        value="icon"
                        checked={form.symbolType === 'icon'}
                        onChange={() => setForm({ ...form, symbolType: 'icon' })}
                        className="w-4 h-4 accent-primary-500"
                      />
                      <span className={`text-sm font-medium ${form.symbolType === 'icon' ? 'text-white' : 'text-white/40'}`}>
                        Choose from Symbol List
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="symbolType"
                        value="image"
                        checked={form.symbolType === 'image'}
                        onChange={() => setForm({ ...form, symbolType: 'image' })}
                        className="w-4 h-4 accent-primary-500"
                      />
                      <span className={`text-sm font-medium ${form.symbolType === 'image' ? 'text-white' : 'text-white/40'}`}>
                        Choose File
                      </span>
                    </label>
                  </div>

                  {/* Icon Picker */}
                  {form.symbolType === 'icon' && (
                    <div className="space-y-2">
                      {form.symbolIcon && (
                        <span className="text-xs text-primary-400 font-bold flex items-center gap-1.5 bg-primary-500/10 px-2 py-0.5 rounded-lg border border-primary-500/20 w-fit">
                          Selected: <span className="text-base">{form.symbolIcon}</span>
                        </span>
                      )}
                      <input
                        type="text"
                        className="form-input text-sm"
                        value={form.symbolIcon}
                        onChange={(e) => setForm({ ...form, symbolIcon: e.target.value })}
                        placeholder="Type or paste custom emoji (e.g. 🦁, 🦅, 🚀)..."
                      />
                      <div className="max-h-36 overflow-y-auto p-2 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-white/30 mb-1.5">
                          Choose from Symbol List
                        </p>
                        <div className="grid grid-cols-7 sm:grid-cols-10 gap-1">
                          {ICONS.map((ic) => (
                            <button
                              key={ic}
                              type="button"
                              onClick={() => setForm({ ...form, symbolIcon: ic })}
                              className={`h-8 w-8 rounded-lg text-lg flex items-center justify-center transition-all ${
                                form.symbolIcon === ic
                                  ? 'bg-primary-500 text-white shadow scale-105 border border-primary-300'
                                  : 'bg-white/5 hover:bg-white/15 text-white/80 border border-transparent'
                              }`}
                              title={`Select ${ic}`}
                            >
                              {ic}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Image Upload */}
                  {form.symbolType === 'image' && (
                    <div>
                      {symbolImagePreview ? (
                        <div className="border border-white/10 rounded-xl p-4 bg-white/5 flex flex-col items-center gap-3">
                          <p className="text-[10px] uppercase font-bold tracking-wider text-white/30">Preview</p>
                          <img
                            src={symbolImagePreview}
                            alt="Symbol preview"
                            className="w-20 h-20 object-contain rounded-xl bg-white/5 p-1"
                          />
                          <div className="flex gap-2">
                            <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all flex items-center gap-1.5">
                              <Upload size={12} /> Replace
                              <input
                                type="file"
                                accept="image/png,image/jpg,image/jpeg,image/svg+xml,image/webp"
                                className="hidden"
                                onChange={(e) => handleSymbolImageSelect(e.target.files[0])}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={removeSymbolImage}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-all"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleSymbolImageDrop}
                          className="border-2 border-dashed border-white/15 hover:border-primary-500/50 rounded-xl p-5 text-center transition-all cursor-pointer bg-white/3 hover:bg-primary-500/5"
                        >
                          <Upload size={22} className="mx-auto text-white/30 mb-2" />
                          <p className="text-white/60 text-sm font-semibold mb-0.5">Drag & Drop Image Here</p>
                          <p className="text-white/30 text-xs mb-3">or</p>
                          <label className="cursor-pointer inline-block px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 border border-primary-500/30 transition-all">
                            Choose Image
                            <input
                              type="file"
                              accept="image/png,image/jpg,image/jpeg,image/svg+xml,image/webp"
                              className="hidden"
                              onChange={(e) => handleSymbolImageSelect(e.target.files[0])}
                            />
                          </label>
                          <p className="text-white/20 text-[10px] mt-3 font-semibold tracking-wider">
                            PNG • JPG • SVG • WEBP
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-white/60 text-sm block mb-1">Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhotoFile(e.target.files[0])}
                    className="text-white/60 text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/60 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-white/60 text-sm block mb-1">Manifesto / Description</label>
                  <textarea
                    className="form-input h-20 resize-none py-2"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief description or manifesto..."
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="candidate-active"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500"
                  />
                  <label htmlFor="candidate-active" className="text-white/80 text-sm font-medium cursor-pointer">
                    Active (Include in ballot)
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowModal(false)} className="flex-1 btn-ghost">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary">
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
                  ) : editItem ? (
                    'Update'
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
