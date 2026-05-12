import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, UserCog } from 'lucide-react'
import { usersAPI, boothsAPI } from '../../services/api'
import toast from 'react-hot-toast'

const emptyForm = { name: '', email: '', password: '', boothId: '', isActive: true }

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [booths, setBooths] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    try {
      const [uRes, bRes] = await Promise.all([usersAPI.getAll(), boothsAPI.getAll()])
      setUsers(uRes.data.data)
      setBooths(bRes.data.data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const openCreate = () => { setForm(emptyForm); setEditItem(null); setShowModal(true) }
  const openEdit = (u) => {
    setForm({ name: u.name, email: u.email, password: '', boothId: u.boothId?._id || '', isActive: u.isActive })
    setEditItem(u); setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.email) return toast.error('Name and email required')
    if (!editItem && !form.password) return toast.error('Password required for new user')
    setSaving(true)
    try {
      const payload = { ...form, role: 'booth_admin' }
      if (!payload.password) delete payload.password
      if (editItem) { await usersAPI.update(editItem._id, payload); toast.success('Updated!') }
      else { await usersAPI.create(payload); toast.success('Created!') }
      setShowModal(false); fetchAll()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this admin?')) return
    try { await usersAPI.delete(id); toast.success('Deleted'); fetchAll() }
    catch { toast.error('Error') }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Booth Admins</h1>
          <p className="text-white/40 text-sm">{users.length} admins configured</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Admin</button>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Assigned Booth</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-xs font-bold">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="text-white/60">{u.email}</td>
                  <td>
                    {u.boothId ? (
                      <span className="text-xs px-2 py-1 bg-primary-500/15 text-primary-400 rounded-lg border border-primary-500/20">
                        {u.boothId.name} ({u.boothId.code})
                      </span>
                    ) : <span className="text-white/30 text-xs">Unassigned</span>}
                  </td>
                  <td><span className={u.isActive ? 'badge-active' : 'badge-idle'}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(u._id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr><td colSpan={5} className="text-center py-12 text-white/30">
                  <UserCog size={32} className="mx-auto mb-2 opacity-20" /><p>No booth admins yet</p>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card p-6 w-full max-w-md" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
              <h2 className="text-xl font-bold text-white mb-5">{editItem ? 'Edit' : 'Add'} Booth Admin</h2>
              <div className="space-y-3">
                {[['Name *', 'name', 'Full name', 'text'], ['Email *', 'email', 'email@example.com', 'email'], ['Password ' + (editItem ? '(leave blank to keep)' : '*'), 'password', '••••••', 'password']].map(([label, key, ph, type]) => (
                  <div key={key}>
                    <label className="text-white/60 text-sm block mb-1">{label}</label>
                    <input type={type} className="form-input" placeholder={ph} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                  </div>
                ))}
                <div>
                  <label className="text-white/60 text-sm block mb-1">Assign Booth</label>
                  <select className="form-input" value={form.boothId} onChange={e => setForm({ ...form, boothId: e.target.value })}>
                    <option value="">Select booth...</option>
                    {booths.map(b => <option key={b._id} value={b._id}>{b.name} ({b.code})</option>)}
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
