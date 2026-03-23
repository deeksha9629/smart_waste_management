import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { recyclingAPI } from '../../services/api'
import toast from 'react-hot-toast'

const STATUS_BADGE = {
  received:   'badge-blue',
  sorting:    'badge-gold',
  processing: 'badge-orange',
  completed:  'badge-green',
  rejected:   'badge-red',
}
const STATUSES = ['received', 'sorting', 'processing', 'completed', 'rejected']

const EMPTY_FORM = {
  vehicle_id: '',
  waste_type: 'general',
  gross_weight_kg: '',
  net_weight_kg: '',
  quality_grade: 'A',
  notes: '',
}

export default function IncomingWaste() {
  const [intake,     setIntake]     = useState([])
  const [filter,     setFilter]     = useState('')
  const [loading,    setLoading]    = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lastHash,   setLastHash]   = useState(null)   // blockchain hash of last submission
  const [form,       setForm]       = useState(EMPTY_FORM)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const load = useCallback(async () => {
    try {
      const res = await recyclingAPI.getIntake()
      setIntake(res.data?.intake || [])
    } catch {
      toast.error('Failed to load intake records')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.gross_weight_kg) { toast.error('Gross weight is required'); return }
    setSubmitting(true)
    setLastHash(null)
    try {
      const res = await recyclingAPI.recordIntake({
        ...form,
        gross_weight_kg: parseFloat(form.gross_weight_kg),
        net_weight_kg: form.net_weight_kg ? parseFloat(form.net_weight_kg) : undefined,
        vehicle_id: form.vehicle_id || undefined,
        notes: form.notes || undefined,
      })
      toast.success(`Intake recorded — ${res.data?.intake_id}`)
      if (res.data?.blockchain_hash) setLastHash(res.data.blockchain_hash)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to record intake'
      toast.error(String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusUpdate = async (intakeId, newStatus) => {
    try {
      await recyclingAPI.updateIntakeStatus(intakeId, newStatus)
      toast.success(`${intakeId} → ${newStatus}`)
      load()
    } catch { toast.error('Failed to update status') }
  }

  const filtered = filter ? intake.filter((r) => r.processing_status === filter) : intake

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">INCOMING WASTE</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Record intake form ── */}
        <div className="card card-accent-gold space-y-4">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary">RECORD NEW INTAKE</h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Vehicle ID <span className="text-txt-secondary">(optional)</span></label>
              <input
                type="text"
                className="input text-xs"
                placeholder="e.g. VEH-001"
                value={form.vehicle_id}
                onChange={set('vehicle_id')}
              />
            </div>

            <div>
              <label className="text-xs text-txt-secondary block mb-1">Waste Type *</label>
              <select className="input text-xs" value={form.waste_type} onChange={set('waste_type')}>
                {['general', 'recyclable', 'organic', 'hazardous', 'electronic'].map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-txt-secondary block mb-1">Gross Weight (kg) *</label>
                <input
                  type="number" step="0.1" min="0"
                  className="input text-xs"
                  placeholder="0.0"
                  value={form.gross_weight_kg}
                  onChange={set('gross_weight_kg')}
                />
              </div>
              <div>
                <label className="text-xs text-txt-secondary block mb-1">Net Weight (kg)</label>
                <input
                  type="number" step="0.1" min="0"
                  className="input text-xs"
                  placeholder="0.0"
                  value={form.net_weight_kg}
                  onChange={set('net_weight_kg')}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-txt-secondary block mb-1">Quality Grade</label>
              <select className="input text-xs" value={form.quality_grade} onChange={set('quality_grade')}>
                {['A', 'B', 'C', 'rejected'].map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-txt-secondary block mb-1">Notes</label>
              <textarea
                className="input text-xs resize-none"
                rows={2}
                placeholder="Optional notes..."
                value={form.notes}
                onChange={set('notes')}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-gold w-full flex items-center justify-center gap-2"
            >
              {submitting
                ? <span className="spinner" />
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              }
              {submitting ? 'RECORDING...' : 'RECORD INTAKE'}
            </button>
          </form>

          {/* Blockchain confirmation */}
          <AnimatePresence>
            {lastHash && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-lg border border-accent-green/30 bg-accent-green/5 p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-accent-green shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-bold text-accent-green">Blockchain Confirmed</span>
                </div>
                <p className="text-[10px] text-txt-secondary font-mono break-all">{lastHash}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Intake records list ── */}
        <div className="lg:col-span-2 card card-accent-blue">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold tracking-widest text-txt-secondary">
              INTAKE RECORDS <span className="text-txt-secondary font-normal">({filtered.length})</span>
            </h3>
            <div className="flex gap-1 flex-wrap">
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
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 540 }}>
              {filtered.length === 0 ? (
                <p className="text-txt-secondary text-xs text-center py-8">No records found</p>
              ) : filtered.map((r, i) => (
                <motion.div
                  key={r.intake_id || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="p-3 rounded-lg border border-border-dim bg-bg-secondary"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-accent-gold">{r.intake_id}</span>
                    <span className={`badge ${STATUS_BADGE[r.processing_status] || 'badge-gray'}`}>
                      {r.processing_status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-txt-secondary">Type: </span>
                      <span className="badge badge-blue">{r.waste_type}</span>
                    </div>
                    <div>
                      <span className="text-txt-secondary">Gross: </span>
                      <strong>{r.gross_weight_kg?.toFixed(1)} kg</strong>
                    </div>
                    <div>
                      <span className="text-txt-secondary">Net: </span>
                      <strong>{r.net_weight_kg?.toFixed(1) || '—'} kg</strong>
                    </div>
                    <div>
                      <span className="text-txt-secondary">Grade: </span>
                      <strong className={
                        r.quality_grade === 'A' ? 'text-accent-green' :
                        r.quality_grade === 'rejected' ? 'text-critical' : 'text-accent-gold'
                      }>{r.quality_grade || '—'}</strong>
                    </div>
                  </div>

                  {r.vehicle_id && (
                    <div className="text-[10px] text-txt-secondary mb-2">
                      Vehicle: <span className="font-mono text-txt-primary">{r.vehicle_id}</span>
                    </div>
                  )}

                  {r.received_at && (
                    <div className="text-[10px] text-txt-secondary mb-2">
                      Received: {format(new Date(r.received_at), 'MMM d, HH:mm')}
                    </div>
                  )}

                  {/* Status advance buttons */}
                  {!['completed', 'rejected'].includes(r.processing_status) && (
                    <div className="flex gap-1 flex-wrap">
                      {STATUSES.filter((s) => s !== r.processing_status && s !== 'received').map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusUpdate(r.intake_id, s)}
                          className={`btn text-[10px] py-0.5 px-2 ${s === 'rejected' ? 'btn-danger' : 'btn-ghost'}`}
                        >
                          → {s}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
