import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { citizensAPI } from '../../services/api'
import toast from 'react-hot-toast'

const REPORT_TYPES = [
  { id: 'illegal_dumping',   icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>, label: 'Illegal Dumping',   desc: 'Waste dumped in unauthorized area' },
  { id: 'bin_overflow',      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>, label: 'Bin Overflow',      desc: 'Bin is overflowing or full' },
  { id: 'damaged_bin',       icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>, label: 'Damaged Bin',       desc: 'Bin is broken or vandalized' },
  { id: 'missed_collection', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h10l2-2z" /></svg>, label: 'Missed Collection', desc: 'Scheduled pickup was skipped' },
  { id: 'general_complaint', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>, label: 'General Complaint',  desc: 'Other waste-related issue' },
]

const STATUS_BADGE = { pending: 'badge-gold', investigating: 'badge-blue', resolved: 'badge-green', rejected: 'badge-gray' }

export default function ReportWaste() {
  const [form, setForm] = useState({
    report_type: '', description: '', address: '',
    location_lat: '', location_lng: '', bin_id: '', priority: 'medium',
  })
  const [reports,    setReports]    = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [loading,    setLoading]    = useState(true)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    citizensAPI.getMyReports()
      .then((r) => setReports(r.data?.reports || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          location_lat: pos.coords.latitude.toFixed(6),
          location_lng: pos.coords.longitude.toFixed(6),
        }))
        toast.success('Location captured!')
      },
      () => toast.error('Location access denied')
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.report_type) { toast.error('Please select a report type'); return }
    if (!form.description)  { toast.error('Please add a description'); return }
    setSubmitting(true)
    try {
      const payload = { ...form }
      if (payload.location_lat) payload.location_lat = parseFloat(payload.location_lat)
      if (payload.location_lng) payload.location_lng = parseFloat(payload.location_lng)
      if (!payload.bin_id) delete payload.bin_id
      await citizensAPI.reportWaste(payload)
      toast.success('Report submitted! +5 tokens earned 🪙')
      setForm({ report_type: '', description: '', address: '', location_lat: '', location_lng: '', bin_id: '', priority: 'medium' })
      const r = await citizensAPI.getMyReports()
      setReports(r.data?.reports || [])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">REPORT WASTE ISSUE</h1>
        <p className="text-xs text-txt-secondary mt-1">Earn +5 tokens for every verified report</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="card card-accent-green">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">NEW REPORT</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type selector */}
            <div>
              <p className="text-xs text-txt-secondary mb-2">Report Type *</p>
              <div className="grid grid-cols-1 gap-2">
                {REPORT_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, report_type: t.id }))}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${form.report_type === t.id ? 'border-accent-green bg-accent-green/10' : 'border-border-dim hover:border-accent-green/40'}`}
                  >
                    <span className="text-xl">{t.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-txt-primary">{t.label}</div>
                      <div className="text-[10px] text-txt-secondary">{t.desc}</div>
                    </div>
                    {form.report_type === t.id && <span className="ml-auto text-accent-green">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Description *</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="Describe the issue in detail..."
                value={form.description}
                onChange={set('description')}
              />
            </div>

            {/* Location */}
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Location</label>
              <div className="flex gap-2 mb-2">
                <input type="text" className="input text-xs" placeholder="Latitude" value={form.location_lat} onChange={set('location_lat')} />
                <input type="text" className="input text-xs" placeholder="Longitude" value={form.location_lng} onChange={set('location_lng')} />
                <button type="button" onClick={getLocation} className="btn btn-ghost text-xs px-3 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
              </div>
              <input type="text" className="input text-xs" placeholder="Address (optional)" value={form.address} onChange={set('address')} />
            </div>

            {/* Bin ID */}
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Bin ID (optional)</label>
              <input type="text" className="input text-xs" placeholder="e.g. BIN-001" value={form.bin_id} onChange={set('bin_id')} />
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Priority</label>
              <select className="input text-xs" value={form.priority} onChange={set('priority')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <button type="submit" disabled={submitting} className="btn btn-success w-full flex items-center justify-center gap-2">
              {submitting ? <span className="spinner" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
              {submitting ? 'SUBMITTING...' : 'SUBMIT REPORT (+5 pts)'}
            </button>
          </form>
        </div>

        {/* My reports */}
        <div className="card card-accent-blue">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">MY REPORTS</h3>
          {loading ? (
            <div className="flex justify-center py-8"><div className="spinner" /></div>
          ) : reports.length === 0 ? (
            <p className="text-txt-secondary text-sm text-center py-8">No reports submitted yet.</p>
          ) : (
            <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 520 }}>
              {reports.map((r, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-3 rounded-lg border border-border-dim bg-bg-secondary"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-accent-blue">{r.report_id}</span>
                    <span className={`badge ${STATUS_BADGE[r.status] || 'badge-gray'}`}>{r.status}</span>
                  </div>
                  <div className="text-xs font-semibold text-txt-primary mb-1 flex items-center gap-2">
                    <span className="text-txt-secondary">{REPORT_TYPES.find((t) => t.id === r.report_type)?.icon}</span>
                    {r.report_type?.replace(/_/g, ' ')}
                  </div>
                  <p className="text-[10px] text-txt-secondary line-clamp-2">{r.description}</p>
                  <div className="text-[10px] text-txt-secondary mt-1">
                    {r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy HH:mm') : '—'}
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
