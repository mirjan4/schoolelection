import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Edit2, Trash2, Layers, CheckCircle2, AlertTriangle, Hash, ArrowUpDown, Power } from 'lucide-react'
import { positionsAPI } from '../../services/api'
import toast from 'react-hot-toast'
import ExportButtons from '../../components/ExportButtons'

const emptyForm = { name: '', maxVotes: 1, displayOrder: 0, active: true }

export default function PositionsPage() {
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchPositions = async () => {
    try {
      const res = await positionsAPI.getAll()
      setPositions(res.data.data)
    } catch (err) {
      toast.error('Failed to load positions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPositions()
  }, [])

  const openCreate = () => {
    setForm(emptyForm)
    setEditItem(null)
    setShowModal(true)
  }

  const openEdit = (p) => {
    setForm({
      name: p.name,
      maxVotes: p.maxVotes,
      displayOrder: p.displayOrder,
      active: p.active,
    })
    setEditItem(p)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Position name is required')
    if (form.maxVotes < 1) return toast.error('Max votes must be at least 1')
    setSaving(true)
    try {
      if (editItem) {
        await positionsAPI.update(editItem._id, form)
        toast.success('Position updated successfully!')
      } else {
        await positionsAPI.create(form)
        toast.success('Position created successfully!')
      }
      setShowModal(false)
      fetchPositions()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving position')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this position? Any candidates linked to this position will lose their position reference.')) return
    try {
      await positionsAPI.delete(id)
      toast.success('Position deleted successfully')
      fetchPositions()
    } catch (err) {
      toast.error('Failed to delete position')
    }
  }

  const toggleActive = async (p) => {
    try {
      await positionsAPI.update(p._id, { ...p, active: !p.active })
      toast.success(`Position ${p.active ? 'deactivated' : 'activated'}!`)
      fetchPositions()
    } catch (err) {
      toast.error('Failed to update position status')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">College Positions</h1>
          <p className="text-white/40 text-sm">{positions.length} positions defined for College Mode</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons
            title="College Positions Overview Report"
            subtitle="Configured positions for College Union Election"
            columns={[
              { header: 'Display Order', dataKey: 'displayOrder' },
              { header: 'Position Name', dataKey: 'name' },
              { header: 'Max Votes Allowed', dataKey: 'maxVotes' },
              { header: 'Status', cell: (p) => (p.active ? 'Active' : 'Inactive') },
            ]}
            data={positions}
            fileName="College_Positions_Report.pdf"
          />
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Position
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="glass-card p-6">
          {positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Display Order</th>
                    <th>Position Name</th>
                    <th>Max Votes</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p._id} className={p.active ? '' : 'opacity-50'}>
                      <td>
                        <span className="font-mono text-xs px-2 py-0.5 bg-white/5 rounded flex items-center gap-1.5 w-fit">
                          <ArrowUpDown size={10} className="text-white/30" />
                          {p.displayOrder}
                        </span>
                      </td>
                      <td className="text-white font-medium">{p.name}</td>
                      <td>
                        <span className="flex items-center gap-1 text-white/70">
                          <Hash size={12} className="text-white/30" />
                          {p.maxVotes}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => toggleActive(p)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                            p.active
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                              : 'bg-white/5 border-white/10 text-white/40'
                          }`}
                        >
                          <Power size={10} />
                          {p.active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all"
                            title="Edit Position"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(p._id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"
                            title="Delete Position"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-white/30 space-y-2">
              <Layers size={36} className="mx-auto opacity-20" />
              <p className="text-sm">No positions defined yet.</p>
              <p className="text-xs text-white/20">Positions are required when running a College Union Election.</p>
            </div>
          )}
        </div>
      )}

      {/* Info Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 border-blue-500/20 bg-blue-500/5">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-2">
          <CheckCircle2 size={16} className="text-primary-400" /> College Union positions guidelines
        </h3>
        <ul className="list-disc list-inside text-xs text-white/50 space-y-1">
          <li>Create positions in the order you want them to appear in the voting flow (sorted by <strong>Display Order</strong>).</li>
          <li>For positions where students select multiple candidates (e.g. Councillor), set <strong>Max Votes</strong> accordingly.</li>
          <li>Ensure you add candidates for each active position under the <strong>Candidates</strong> tab.</li>
        </ul>
      </motion.div>

      {/* Create/Edit Modal */}
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
              className="glass-card p-6 w-full max-w-md"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <h2 className="text-xl font-bold text-white mb-4">{editItem ? 'Edit' : 'Add'} Position</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-white/60 text-sm block mb-1">Position Name *</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Chairperson"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-white/60 text-sm block mb-1">Maximum Votes *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.maxVotes}
                      onChange={(e) => setForm({ ...form, maxVotes: parseInt(e.target.value) || 1 })}
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="text-white/60 text-sm block mb-1">Display Order *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={form.displayOrder}
                      onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="position-active"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="rounded border-white/10 bg-white/5 text-primary-500 focus:ring-primary-500"
                  />
                  <label htmlFor="position-active" className="text-white/80 text-sm font-medium cursor-pointer">
                    Active (Include in Kiosk flow)
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
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
