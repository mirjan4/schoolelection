import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, Trophy, Star } from 'lucide-react'
import { candidatesAPI } from '../../services/api'
import toast from 'react-hot-toast'

const emptyForm = { name: '', symbol: '', symbolIcon: '⭐', electionType: 'school_leader', class: '', description: '', active: true }
const ICONS = ['⭐', '🦁', '🦅', '🌺', '⚡', '🎯', '🌟', '🏆', '🔥', '💎', '🌙', '🎪']

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const fetchCandidates = async () => {
    try {
      const res = await candidatesAPI.getAll()
      setCandidates(res.data.data)
    } catch { toast.error('Failed to load candidates') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchCandidates() }, [])

  const schoolLeaders = candidates.filter(c => c.electionType === 'school_leader')
  const classLeaders = candidates.filter(c => c.electionType === 'class_leader')

  const openCreate = () => { setForm(emptyForm); setPhotoFile(null); setEditItem(null); setShowModal(true) }
  const openEdit = (c) => {
    setForm({ name: c.name, symbol: c.symbol, symbolIcon: c.symbolIcon || '⭐', electionType: c.electionType, class: c.class || '', description: c.description || '', active: c.active })
    setPhotoFile(null); setEditItem(c); setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name) return toast.error('Name required')
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (photoFile) fd.append('photo', photoFile)
      if (editItem) { await candidatesAPI.update(editItem._id, fd); toast.success('Updated!') }
      else { await candidatesAPI.create(fd); toast.success('Created!') }
      setShowModal(false); fetchCandidates()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this candidate?')) return
    try { await candidatesAPI.delete(id); toast.success('Deleted'); fetchCandidates() }
    catch { toast.error('Error') }
  }

  const Card = ({ c }) => (
    <div className="glass-card p-4 hover:border-white/20 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
          {c.photo ? <img src={c.photo} alt={c.name} className="w-full h-full object-cover" /> : c.symbolIcon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold truncate">{c.name}</h3>
          <p className="text-white/40 text-xs">{c.symbol}</p>
          <span className="text-xs px-2 py-0.5 bg-primary-500/15 text-primary-400 rounded-full border border-primary-500/20 mt-1 inline-block">{c.voteCount} votes</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"><Edit2 size={14} /></button>
          <button onClick={() => handleDelete(c._id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Candidates</h1>
          <p className="text-white/40 text-sm">{candidates.length} candidates</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Candidate</button>
      </div>

      {loading ? <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div> : (
        <div className="space-y-6">
          <div>
            <h2 className="text-white/70 font-semibold mb-3 flex items-center gap-2"><Trophy size={16} className="text-gold-400" /> School Leader ({schoolLeaders.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {schoolLeaders.map(c => <Card key={c._id} c={c} />)}
              {!schoolLeaders.length && <p className="text-white/30 text-sm py-6">No school leader candidates</p>}
            </div>
          </div>
          <div>
            <h2 className="text-white/70 font-semibold mb-6 flex items-center gap-2">
              <Star size={16} className="text-primary-400" /> Class Leader ({classLeaders.length})
            </h2>
            
            <div className="space-y-8">
              {Object.entries(
                classLeaders.reduce((acc, c) => {
                  const cls = c.class || 'Unassigned';
                  if (!acc[cls]) acc[cls] = [];
                  acc[cls].push(c);
                  return acc;
                }, {})
              ).sort((a, b) => a[0].localeCompare(b[0])).map(([cls, list]) => (
                <div key={cls} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-white/5"></span>
                    <span className="text-xs font-black tracking-widest text-white/20 uppercase bg-white/5 px-3 py-1 rounded-full border border-white/5">Class {cls}</span>
                    <span className="h-px flex-1 bg-white/5"></span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map(c => <Card key={c._id} c={c} />)}
                  </div>
                </div>
              ))}
              {classLeaders.length === 0 && <p className="text-white/30 text-sm py-6">No class leader candidates</p>}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
              <h2 className="text-xl font-bold text-white mb-4">{editItem ? 'Edit' : 'Add'} Candidate</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-white/60 text-sm block mb-1">Election Type</label>
                  <select className="form-input" value={form.electionType} onChange={e => setForm({ ...form, electionType: e.target.value })}>
                    <option value="school_leader">School Leader</option>
                    <option value="class_leader">Class Leader</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-1">Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Candidate name" />
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-1">Symbol</label>
                  <input className="form-input" value={form.symbol} onChange={e => setForm({ ...form, symbol: e.target.value })} placeholder="e.g. Rising Star" />
                </div>
                <div>
                  <label className="text-white/60 text-sm block mb-2">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {ICONS.map(ic => (
                      <button key={ic} type="button" onClick={() => setForm({ ...form, symbolIcon: ic })}
                        className={`w-10 h-10 rounded-xl text-xl transition-all ${form.symbolIcon === ic ? 'bg-primary-500/30 border-2 border-primary-400' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}>
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
                {form.electionType === 'class_leader' && (
                  <div>
                    <label className="text-white/60 text-sm block mb-1">Class (e.g. 10A, 8B) *</label>
                    <input className="form-input" value={form.class} onChange={e => setForm({ ...form, class: e.target.value.toUpperCase() })} placeholder="e.g. 10A" />
                  </div>
                )}
                <div>
                  <label className="text-white/60 text-sm block mb-1">Photo</label>
                  <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])}
                    className="text-white/60 text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/60 cursor-pointer" />
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
