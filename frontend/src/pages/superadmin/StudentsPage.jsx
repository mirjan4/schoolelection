import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { Plus, Edit2, Trash2, Search, Users, CheckCircle, XCircle, FileUp, Info, Building2, UserCheck, X, Check, Loader2, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { studentsAPI, boothsAPI, electionAPI } from '../../services/api'
import { useSocket } from '../../context/SocketContext'
import toast from 'react-hot-toast'

import ExportButtons from '../../components/ExportButtons'

const emptyForm = { admissionNo: '', name: '', class: '', section: '', boothId: '' }

export default function StudentsPage() {
  const { socket } = useSocket()
  const [students, setStudents] = useState([])
  const [booths, setBooths] = useState([])
  const [election, setElection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBooth, setFilterBooth] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  // Selection & Pagination states
  const [selectedIds, setSelectedIds] = useState([])
  const [currentPage, setCurrentPage] = useState(1)

  // Sorting state (Default: admissionNo ascending)
  const [sortBy, setSortBy] = useState('admissionNo')
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' | 'desc'

  // Bulk Assign Booth Modal State
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false)
  const [selectedTargetBoothId, setSelectedTargetBoothId] = useState('')
  const [assigningBooth, setAssigningBooth] = useState(false)
  const [modalBoothSearch, setModalBoothSearch] = useState('')

  const fetchAll = async (overrideSortBy = sortBy, overrideSortOrder = sortOrder) => {
    try {
      const [sRes, bRes, eRes] = await Promise.all([
        studentsAPI.getAll({ sortBy: overrideSortBy, sortOrder: overrideSortOrder }),
        boothsAPI.getAll(),
        electionAPI.status()
      ])
      setStudents(sRes.data.data)
      setBooths(bRes.data.data)
      setElection(eRes.data.data)
    } catch (err) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll(sortBy, sortOrder)
  }, [sortBy, sortOrder])

  // Socket.IO real-time updates for booth assignment and stats changes
  useEffect(() => {
    if (!socket) return
    const handleRealtimeUpdate = () => {
      fetchAll(sortBy, sortOrder)
    }
    socket.on('students:boothUpdated', handleRealtimeUpdate)
    socket.on('booth_assignment_changed', handleRealtimeUpdate)
    socket.on('stats_update', handleRealtimeUpdate)
    return () => {
      socket.off('students:boothUpdated', handleRealtimeUpdate)
      socket.off('booth_assignment_changed', handleRealtimeUpdate)
      socket.off('stats_update', handleRealtimeUpdate)
    }
  }, [socket, sortBy, sortOrder])

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q)
    const matchBooth = !filterBooth || String(s.boothId?._id || s.boothId) === filterBooth
    return matchSearch && matchBooth
  })

  // Clear selections & reset page when filter changes
  useEffect(() => {
    setSelectedIds([])
    setCurrentPage(1)
  }, [search, filterBooth])

  const isCollege = election?.type === 'college'

  // Helper to determine if a student has voted
  const getStudentVotedStatus = (s) => {
    if (isCollege) return !!s.hasVotedCollege
    return !!(s.hasVotedClassLeader || s.hasVotedSchoolLeader)
  }

  // Client-side Sorting (Applies on filtered list for smooth sorting)
  const sortedStudents = [...filtered].sort((a, b) => {
    const dir = sortOrder === 'desc' ? -1 : 1

    if (sortBy === 'admissionNo') {
      return dir * a.admissionNo.localeCompare(b.admissionNo, undefined, { numeric: true, sensitivity: 'base' })
    }
    if (sortBy === 'name') {
      return dir * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    }
    if (sortBy === 'class') {
      return dir * String(a.class).localeCompare(String(b.class), undefined, { numeric: true, sensitivity: 'base' })
    }
    if (sortBy === 'section') {
      return dir * String(a.section || '').localeCompare(String(b.section || ''), undefined, { sensitivity: 'base' })
    }
    if (sortBy === 'booth') {
      const nameA = a.boothId?.name || ''
      const nameB = b.boothId?.name || ''
      return dir * nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
    }
    if (sortBy === 'voted') {
      // asc -> Not Voted first (0 before 1)
      // desc -> Voted first (1 before 0)
      const votedA = getStudentVotedStatus(a) ? 1 : 0
      const votedB = getStudentVotedStatus(b) ? 1 : 0
      return dir * (votedA - votedB)
    }
    return 0
  })

  // Pagination parameters
  const itemsPerPage = 10
  const totalItems = sortedStudents.length
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = sortedStudents.slice(startIndex, endIndex)

  // Header Sort Click Handler
  const handleSortHeader = (field) => {
    if (sortBy === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else {
        // Reset to default sorting (admissionNo asc)
        setSortBy('admissionNo')
        setSortOrder('asc')
      }
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  // Render Sortable Table Header Component
  const renderSortableHeader = (field, label) => {
    const isActive = sortBy === field
    return (
      <th
        onClick={() => handleSortHeader(field)}
        className={`cursor-pointer select-none transition-colors px-4 py-3 group hover:bg-white/5 ${
          isActive ? 'text-primary-400 font-bold bg-white/5' : 'text-white/60 hover:text-white'
        }`}
        title={`Click to sort by ${label}`}
      >
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          <span className="transition-transform inline-flex">
            {isActive ? (
              sortOrder === 'asc' ? (
                <ArrowUp size={14} className="text-primary-400" />
              ) : (
                <ArrowDown size={14} className="text-primary-400" />
              )
            ) : (
              <ArrowUpDown size={14} className="text-white/30 group-hover:text-white/60" />
            )}
          </span>
        </div>
      </th>
    )
  }

  // Selection Handlers
  const handleSelectRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (paginatedItems.length > 0 && paginatedItems.every(s => selectedIds.includes(s._id))) {
      setSelectedIds(prev => prev.filter(id => !paginatedItems.some(s => s._id === id)))
    } else {
      const idsToAdd = paginatedItems.map(s => s._id).filter(id => !selectedIds.includes(id))
      setSelectedIds(prev => [...prev, ...idsToAdd])
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected students?`)) return
    try {
      await studentsAPI.bulkDelete(selectedIds)
      toast.success(`Successfully deleted ${selectedIds.length} students!`)
      setSelectedIds([])
      fetchAll()
    } catch {
      toast.error('Failed to delete selected students')
    }
  }

  const getBoothStudentCount = (bId) => {
    return students.filter(s => String(s.boothId?._id || s.boothId) === String(bId)).length
  }

  const handleConfirmBulkAssign = async () => {
    if (!selectedTargetBoothId) return toast.error('Please select a booth')
    setAssigningBooth(true)
    try {
      await studentsAPI.bulkAssignBooth({
        studentIds: selectedIds,
        boothId: selectedTargetBoothId
      })
      const targetBooth = booths.find(b => b._id === selectedTargetBoothId)
      const count = selectedIds.length
      toast.success(`${count} student${count !== 1 ? 's' : ''} assigned to ${targetBooth?.name || 'Booth'} successfully.`)
      setSelectedIds([])
      setShowBulkAssignModal(false)
      setSelectedTargetBoothId('')
      setModalBoothSearch('')
      fetchAll()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign booth')
    } finally {
      setAssigningBooth(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)

        // Map and validate data
        const mapped = data.map(row => ({
          admissionNo: String(row['Admission No'] || row['AdmissionNo'] || row['adm_no'] || ''),
          name: row['Name'] || row['Full Name'] || row['student_name'] || '',
          class: String(row['Class'] || row['class'] || ''),
          section: String(row['Section'] || row['section'] || ''),
        })).filter(s => s.name && s.admissionNo)

        if (mapped.length === 0) throw new Error('No valid students found in file')

        if (confirm(`Import ${mapped.length} students?`)) {
          await studentsAPI.bulkCreate(mapped)
          toast.success(`Successfully imported ${mapped.length} students!`)
          fetchAll()
        }
      } catch (err) {
        toast.error(err.message || 'Error parsing file')
      } finally {
        setImporting(false)
        e.target.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  const openCreate = () => {
    setForm({
      ...emptyForm,
      boothId: booths.length === 1 ? booths[0]._id : ''
    })
    setEditItem(null)
    setShowModal(true)
  }
  const openEdit = (s) => {
    setForm({ admissionNo: s.admissionNo, name: s.name, class: s.class, section: s.section, boothId: s.boothId?._id || s.boothId || '' })
    setEditItem(s); setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.admissionNo || !form.name || !form.class) return toast.error('Fill all required fields')
    setSaving(true)
    try {
      if (editItem) { await studentsAPI.update(editItem._id, form); toast.success('Student updated!') }
      else { await studentsAPI.create(form); toast.success('Student created!') }
      setShowModal(false); fetchAll()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this student?')) return
    try { await studentsAPI.delete(id); toast.success('Deleted'); fetchAll() }
    catch (err) { toast.error('Error deleting') }
  }

  const selectedStudents = students.filter(s => selectedIds.includes(s._id))
  const countWithExistingBooth = selectedStudents.filter(s => s.boothId).length

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-white/40 text-sm">{students.length} students enrolled</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons
            title={filterBooth ? 'Booth Student List' : 'Enrolled Students Directory Report'}
            subtitle={
              filterBooth
                ? `Booth: ${booths.find((b) => b._id === filterBooth)?.name || 'Selected Booth'}`
                : 'All Enrolled Students'
            }
            boothDetails={
              filterBooth
                ? {
                    name: booths.find((b) => b._id === filterBooth)?.name || 'Selected Booth',
                    code: booths.find((b) => b._id === filterBooth)?.code || 'N/A',
                    location: booths.find((b) => b._id === filterBooth)?.location || 'N/A',
                  }
                : null
            }
            printedBy="Super Admin"
            columns={
              filterBooth
                ? [
                    { header: 'Admission No', dataKey: 'admissionNo' },
                    { header: 'Student Name', dataKey: 'name' },
                    { header: 'Class', dataKey: 'class' },
                    { header: 'Section', cell: (s) => s.section || 'N/A' },
                    {
                      header: 'Voting Status',
                      cell: (s) => {
                        if (election?.type === 'school') {
                          if (s.hasVotedSchoolLeader && s.hasVotedClassLeader) return 'Voted (All)'
                          if (s.hasVotedClassLeader) return 'Voted (Class)'
                          if (s.hasVotedSchoolLeader) return 'Voted (School)'
                          return 'Not Voted'
                        }
                        return s.hasVotedCollege ? 'Voted' : 'Not Voted'
                      },
                    },
                  ]
                : [
                    { header: 'Admission No', dataKey: 'admissionNo' },
                    { header: 'Student Name', dataKey: 'name' },
                    { header: 'Class', cell: (s) => `Class ${s.class}${s.section || ''}` },
                    {
                      header: 'Assigned Booth',
                      cell: (s) => (s.boothId?.name ? `${s.boothId.name} (${s.boothId.code})` : 'Unassigned'),
                    },
                    {
                      header: 'Voting Status',
                      cell: (s) => {
                        if (election?.type === 'school') {
                          if (s.hasVotedSchoolLeader && s.hasVotedClassLeader) return 'Voted (All)'
                          if (s.hasVotedClassLeader) return 'Voted (Class)'
                          if (s.hasVotedSchoolLeader) return 'Voted (School)'
                          return 'Not Voted'
                        }
                        return s.hasVotedCollege ? 'Voted' : 'Not Voted'
                      },
                    },
                  ]
            }
            data={sortedStudents}
            fileName={
              filterBooth
                ? `Booth_${booths.find((b) => b._id === filterBooth)?.code || 'Report'}_Student_List.pdf`
                : 'Students_Directory_Report.pdf'
            }
          />
          <label className={`btn-ghost flex items-center gap-2 cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            <FileUp size={18} />
            {importing ? 'Importing...' : 'Import Excel'}
            <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
          </label>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Student
          </button>
        </div>
      </div>

      {/* Floating Sticky Bulk Action Toolbar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            className="sticky top-4 z-30 flex items-center justify-between gap-4 p-3.5 px-5 bg-slate-900/90 backdrop-blur-xl border border-primary-500/30 rounded-2xl shadow-2xl shadow-primary-950/60"
          >
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary-500/20 text-primary-400 font-bold text-sm">
                {selectedIds.length}
              </span>
              <div>
                <p className="text-white text-sm font-bold leading-none">
                  {selectedIds.length} Student{selectedIds.length > 1 ? 's' : ''} Selected
                </p>
                <p className="text-white/40 text-xs mt-1">
                  Choose a bulk action for selected students
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setSelectedTargetBoothId('')
                  setModalBoothSearch('')
                  setShowBulkAssignModal(true)
                }}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-primary-500/20 active:scale-95"
              >
                <Building2 size={15} /> Assign Booth
              </button>

              <button
                onClick={handleBulkDelete}
                className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Trash2 size={14} /> Delete
              </button>

              <button
                onClick={() => setSelectedIds([])}
                className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl text-xs transition-all"
                title="Clear selection"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input className="form-input pl-9 py-2.5" placeholder="Search by name or admission no..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input py-2.5 w-auto min-w-40" value={filterBooth} onChange={e => setFilterBooth(e.target.value)}>
          <option value="">All Booths</option>
          {booths.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <p className="text-white/60 text-sm">
            {selectedIds.length > 0 ? `${selectedIds.length} of ${filtered.length} selected` : `${filtered.length} students`}
          </p>
          {selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs text-primary-400 hover:text-primary-300 font-semibold"
            >
              Clear Selection
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={paginatedItems.length > 0 && paginatedItems.every(s => selectedIds.includes(s._id))}
                        onChange={handleSelectAll}
                        className="rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </th>
                    {renderSortableHeader('admissionNo', 'Admission No')}
                    {renderSortableHeader('name', 'Name')}
                    {renderSortableHeader('class', 'Class')}
                    {renderSortableHeader('section', 'Section')}
                    {renderSortableHeader('booth', 'Booth')}
                    {isCollege ? (
                      renderSortableHeader('voted', 'Voted')
                    ) : (
                      <>
                        {renderSortableHeader('voted', 'Class Vote')}
                        {renderSortableHeader('voted', 'School Vote')}
                      </>
                    )}
                    <th className="px-4 py-3 text-white/60 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map(s => (
                    <tr key={s._id} className={selectedIds.includes(s._id) ? 'bg-primary-500/5' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(s._id)}
                          onChange={() => handleSelectRow(s._id)}
                          className="rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500 focus:ring-offset-0 cursor-pointer"
                        />
                      </td>
                      <td><span className="font-mono text-xs text-white/60">{s.admissionNo}</span></td>
                      <td className="text-white font-medium">{s.name}</td>
                      <td>{s.class}</td>
                      <td>{s.section}</td>
                      <td><span className="text-xs px-2 py-0.5 bg-white/5 rounded">{s.boothId?.name || '—'}</span></td>
                      {isCollege ? (
                        <td>{s.hasVoted ? <CheckCircle size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-white/20" />}</td>
                      ) : (
                        <>
                          <td>{s.hasVotedClassLeader ? <CheckCircle size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-white/20" />}</td>
                          <td>{s.hasVotedSchoolLeader ? <CheckCircle size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-white/20" />}</td>
                        </>
                      )}
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(s._id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={isCollege ? 8 : 9} className="text-center text-white/30 py-12">
                        <Users size={32} className="mx-auto mb-2 opacity-20" />
                        <p>No students found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination Footer */}
            {filtered.length > 0 && (
              <div className="p-4 border-t border-white/5 flex items-center justify-between flex-wrap gap-3">
                <p className="text-white/40 text-xs">
                  Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} students
                </p>
                <div className="flex gap-2 items-center">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-xs transition-all font-semibold"
                  >
                    Prev
                  </button>
                  <span className="text-white/60 text-xs px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-xs transition-all font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk Assign Booth Modal */}
      <AnimatePresence>
        {showBulkAssignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-6 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Building2 size={20} className="text-primary-400" />
                    Bulk Assign Booth
                  </h2>
                  <p className="text-white/40 text-xs mt-1">
                    Assigning booth for <strong className="text-white font-bold">{selectedIds.length}</strong> selected student{selectedIds.length > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setShowBulkAssignModal(false)}
                  className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Searchable Booth List Body */}
              <div className="py-4 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
                {/* Search input */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    className="form-input pl-9 text-sm py-2"
                    placeholder="Search booth name or code..."
                    value={modalBoothSearch}
                    onChange={(e) => setModalBoothSearch(e.target.value)}
                  />
                </div>

                {/* Booth Options List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {booths
                    .filter((b) => {
                      const q = modalBoothSearch.toLowerCase()
                      return !q || b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q)
                    })
                    .map((b) => {
                      const count = getBoothStudentCount(b._id)
                      const isSelected = selectedTargetBoothId === b._id

                      return (
                        <div
                          key={b._id}
                          onClick={() => setSelectedTargetBoothId(b._id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-primary-500/20 border-primary-500 text-white shadow-lg shadow-primary-500/10'
                              : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                                isSelected ? 'bg-primary-500 text-white' : 'bg-white/10 text-white/60'
                              }`}
                            >
                              {b.code}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-white">{b.name}</p>
                              {b.location && <p className="text-white/40 text-xs">{b.location}</p>}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs px-2.5 py-1 bg-white/5 rounded-lg border border-white/10 text-white/60 font-medium">
                              {count} student{count !== 1 ? 's' : ''}
                            </span>
                            {isSelected && <CheckCircle size={18} className="text-primary-400 flex-shrink-0" />}
                          </div>
                        </div>
                      )
                    })}

                  {booths.length === 0 && (
                    <p className="text-center text-white/30 py-8 text-xs">No booths configured</p>
                  )}
                </div>

                {/* Re-assignment Notice */}
                {selectedTargetBoothId && countWithExistingBooth > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start gap-2.5"
                  >
                    <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold mb-0.5">Confirmation Notice</p>
                      <p className="text-amber-300/80">
                        {countWithExistingBooth === selectedIds.length
                          ? `These ${selectedIds.length} student(s) will be moved from their current booth to ${
                              booths.find((b) => b._id === selectedTargetBoothId)?.name
                            }.`
                          : `${countWithExistingBooth} of the selected student(s) will be moved from their current booth to ${
                              booths.find((b) => b._id === selectedTargetBoothId)?.name
                            }.`}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowBulkAssignModal(false)}
                  className="btn-ghost text-xs px-4 py-2"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmBulkAssign}
                  disabled={!selectedTargetBoothId || assigningBooth}
                  className="btn-primary text-xs px-5 py-2 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {assigningBooth ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Confirm Assignment
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit / Create Student Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-md" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
              <h2 className="text-xl font-bold text-white mb-5">{editItem ? 'Edit Student' : 'Add Student'}</h2>
              <div className="space-y-3">
                {[['Admission No *', 'admissionNo', 'ADM1001'], ['Full Name *', 'name', 'e.g. Arjun Kumar'], ['Class *', 'class', 'e.g. 10'], ['Section', 'section', 'e.g. A']].map(([label, key, ph]) => (
                  <div key={key}>
                    <label className="text-white/60 text-sm block mb-1">{label}</label>
                    <input className="form-input" placeholder={ph} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                  </div>
                ))}
                <div>
                  <label className="text-white/60 text-sm block mb-1">Assign Booth</label>
                  <select className="form-input" value={form.boothId} onChange={e => setForm({ ...form, boothId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {booths.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowModal(false)} className="flex-1 btn-ghost">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary">
                  {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" /> : editItem ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
