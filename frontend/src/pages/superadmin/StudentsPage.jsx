import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { Plus, Edit2, Trash2, Search, Users, CheckCircle, XCircle, FileUp, Info } from 'lucide-react'
import { studentsAPI, boothsAPI } from '../../services/api'
import toast from 'react-hot-toast'

const emptyForm = { admissionNo: '', name: '', class: '', section: '', boothId: '' }

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [booths, setBooths] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBooth, setFilterBooth] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  const fetchAll = async () => {
    try {
      const [sRes, bRes] = await Promise.all([studentsAPI.getAll(), boothsAPI.getAll()])
      setStudents(sRes.data.data)
      setBooths(bRes.data.data)
    } catch (err) { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q)
    const matchBooth = !filterBooth || String(s.boothId?._id || s.boothId) === filterBooth
    return matchSearch && matchBooth
  })

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

  const openCreate = () => { setForm(emptyForm); setEditItem(null); setShowModal(true) }
  const openEdit = (s) => {
    setForm({ admissionNo: s.admissionNo, name: s.name, class: s.class, section: s.section, boothId: s.boothId?._id || s.boothId || '' })
    setEditItem(s); setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.admissionNo || !form.name || !form.class || !form.section) return toast.error('Fill all required fields')
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
        <div className="flex gap-2">
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
          <p className="text-white/60 text-sm">{filtered.length} students</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Admission No</th><th>Name</th><th>Class</th><th>Section</th><th>Booth</th><th>Class Vote</th><th>School Vote</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s._id}>
                    <td><span className="font-mono text-xs text-white/60">{s.admissionNo}</span></td>
                    <td className="text-white font-medium">{s.name}</td>
                    <td>{s.class}</td>
                    <td>{s.section}</td>
                    <td><span className="text-xs px-2 py-0.5 bg-white/5 rounded">{s.boothId?.name || '—'}</span></td>
                    <td>{s.hasVotedClassLeader ? <CheckCircle size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-white/20" />}</td>
                    <td>{s.hasVotedSchoolLeader ? <CheckCircle size={16} className="text-emerald-400" /> : <XCircle size={16} className="text-white/20" />}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(s._id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="text-center text-white/30 py-12"><Users size={32} className="mx-auto mb-2 opacity-20" /><p>No students found</p></td></tr>}
              </tbody>
            </table>
          </div>
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
                {[['Admission No *', 'admissionNo', 'ADM1001'], ['Full Name *', 'name', 'e.g. Arjun Kumar'], ['Class *', 'class', 'e.g. 10'], ['Section *', 'section', 'e.g. A']].map(([label, key, ph]) => (
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
