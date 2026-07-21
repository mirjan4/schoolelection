import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { Plus, Edit2, Trash2, Search, Users, CheckCircle, XCircle, FileUp, Info } from 'lucide-react'
import { studentsAPI, boothsAPI, electionAPI } from '../../services/api'
import toast from 'react-hot-toast'

const emptyForm = { admissionNo: '', name: '', class: '', section: '', boothId: '' }

export default function StudentsPage() {
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

  const fetchAll = async () => {
    try {
      const [sRes, bRes, eRes] = await Promise.all([
        studentsAPI.getAll(),
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
    fetchAll()
  }, [])

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

  // Pagination parameters
  const itemsPerPage = 10
  const totalItems = filtered.length
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filtered.slice(startIndex, endIndex)

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Students</h1>
          <p className="text-white/40 text-sm">{students.length} students enrolled</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-red-500/5"
            >
              <Trash2 size={16} /> Delete Selected ({selectedIds.length})
            </button>
          )}
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
                    <th>Admission No</th>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Booth</th>
                    {isCollege ? (
                      <th>Voted</th>
                    ) : (
                      <>
                        <th>Class Vote</th>
                        <th>School Vote</th>
                      </>
                    )}
                    <th>Actions</th>
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

      {/* Modal */}
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
