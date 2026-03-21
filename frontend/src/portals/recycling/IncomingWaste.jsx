import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { recyclingAPI } from '../../services/api'
import toast from 'react-hot-toast'

const STATUS_BADGE = { received: 'badge-blue', sorting: 'badge-gold', processing: 'badge-orange', completed: 'badge-green', rejected: 'badge-red' }
const STATUSES = ['received', 'sorting', 'processing', 'completed', 'rejected']

export default function IncomingWaste() {
  const [intake,     setIntake]     = useState([])
  const [plants,     setPlants]     = useState([])
  const [filter,     setFilter]     = useState('')
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    plant_id: '', vehicle_id: '', waste_type: 'general',
    gross_weight_kg: '', net_weight_kg: '', quality_grade: 'A', notes: '',
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const load = async () => {
    try {
      const [i, p] = await Promise.all([recyclingAPI.getIntake(), recyclingAPI.getPlants()])
      setIntake(i.data?.intake || [])
      setPlants(p.data || [])
      if (!form.plant_id && p.data?.[0]) setForm((f) => ({ ...f, plant_id: p.data[0].id }))
    } catch { toast.error('Failed to load intake records') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.plant_id || !form.gross_weight_kg) { toast.error('Plant and gross weight are required'); return }
    setSubmitting(true)
    try {
      await recyclingAPI.recordIntake({
        ...form,
        gross_weight_kg: parseFloat(form.gross_weight_kg),
        net_weight_kg: form.net_weight_kg ? parseFloat(form.net_weight_kg) : undefined,
      })
      toast.success('Intake recorded!')
      setForm((f) => ({ ...f, vehicle_id: '', gross_weight_kg: '', net_weight_kg: '', notes: '' }))
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record intake')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusUpdate = async (intakeId, status) => {
    try {
      await recyclingAPI.updateIntakeStatus(intakeId, status)
      toast.success(`Status updated to ${status}`)
      load()
    } catch { toast.error('Failed to update status') }
  }

  const filtered = filter ? intake.filter((r) => r.processing_status === filter) : intake

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">INCOMING WASTE</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Record intake form */}
        <div className="card card-accent-gold">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">RECORD NEW INTAKE</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Plant *</label>
              <select className="input text-xs" value={form.plant_id} onChange={set('plant_id')}>
                <option value="">Select plant</option>
                {plants.map((p) => <option key={p.id} value={p.id}>{p.plant_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Vehicle ID</label>
              <input type="text" className="input text-xs" placeholder="e.g. VEH-001" value={form.vehicle_id} onChange={set('vehicle_id')} />
            </div>
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Waste Type *</label>
              <select className="input text-xs" value={form.waste_type} onChange={set('waste_type')}>
                {['general','recyclable','organic','hazardous','electronic'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-txt-secondary block mb-1">Gross Weight (kg) *</label>
                <input type="number" step="0.1" className="input text-xs" placeholder="0.0" value={form.gross_weight_kg} onChange={set('gross_weight_kg')} />
              </div>
              <div>
                <label className="text-xs text-txt-secondary block mb-1">Net Weight (kg)</label>
                <input type="number" step="0.1" className="input text-xs" placeholder="0.0" value={form.net_weight_kg} onChange={set('net_weight_kg')} />
              </div>
            </div>
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Quality Grade</label>
              <select className="input text-xs" value={form.quality_grade} onChange={set('quality_grade')}>
                {['A','B','C','rejected'].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Notes</label>
              <textarea className="input text-xs resize-none" rows={2} placeholder="Optional notes..." value={form.notes} onChange={set('notes')} />
            </div>
            <button type="submit" disabled={submitting} className="btn btn-gold w-full">
              {submitting ? <span className="spinner" /> : '📥'}
              {submitting ? 'RECORDING...' : 'RECORD INTAKE'}
            </button>
          </form>
        </div>

        {/* Intake list */}
        <div className="lg:col-span-2 card card-accent-blue">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold tracking-widest text-txt-secondary">INTAKE RECORDS</h3>
            <div className="flex gap-1">
              {['', ...STATUSES].map((s) => (
                <button
                  key={s || 'all'}
                  onClick={() => setFilter(s)}
                  className={`btn text-[10px] py-1 px-2 ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {s || 'All'}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><div className="spinner spinner-lg" /></div>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 520 }}>
              {filtered.length === 0 ? (
                <p className="text-txt-secondary text-xs text-center py-8">No records found</p>
              ) : filtered.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="p-3 rounded-lg border border-border-dim bg-bg-secondary"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-accent-gold">{r.intake_id}</span>
                    <span className={`badge ${STATUS_BADGE[r.processing_status] || 'badge-gray'}`}>{r.processing_status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div><span className="text-txt-secondary">Type: </span><span className="badge badge-blue">{r.waste_type}</span></div>
                    <div><span className="text-txt-secondary">Gross: </span><strong>{r.gross_weight_kg?.toFixed(1)} kg</strong></div>
                    <div><span className="text-txt-secondary">Grade: </span><strong>{r.quality_grade || '—'}</strong></div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {STATUSES.filter((s) => s !== r.processing_status).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusUpdate(r.intake_id, s)}
                        className="btn btn-ghost text-[10px] py-0.5 px-2"
                      >
                        → {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
