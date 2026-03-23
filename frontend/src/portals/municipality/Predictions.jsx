import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { predictionsAPI } from '../../services/api'
import toast from 'react-hot-toast'

const PRIORITY_STYLE = {
  CRITICAL: { badge: 'badge-red',    border: '#ef4444', bg: 'rgba(239,68,68,0.05)' },
  HIGH:     { badge: 'badge-orange', border: '#f97316', bg: 'rgba(249,115,22,0.05)' },
  MEDIUM:   { badge: 'badge-gold',   border: '#f59e0b', bg: 'rgba(245,158,11,0.05)' },
  LOW:      { badge: 'badge-green',  border: '#10b981', bg: 'rgba(16,185,129,0.05)' },
}

export default function Predictions() {
  const [predictions, setPredictions] = useState([])
  const [accuracy,    setAccuracy]    = useState(null)
  const [filter,      setFilter]      = useState('all')
  const [loading,     setLoading]     = useState(true)
  const [training,    setTraining]    = useState(false)

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([predictionsAPI.getAll(), predictionsAPI.getAccuracy()])
      setPredictions(p.data?.predictions || [])
      setAccuracy(a.data)
    } catch { toast.error('Failed to load predictions') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleTrain = async () => {
    setTraining(true)
    try {
      const res = await predictionsAPI.train()
      toast.success(res.data.message)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Training failed')
    } finally {
      setTraining(false)
    }
  }

  const filtered = predictions.filter((p) => {
    if (filter === 'overflow') return p.overflow_risk
    if (filter === 'critical') return p.priority === 'CRITICAL'
    if (filter === 'high')     return p.priority === 'HIGH'
    return true
  })

  const counts = {
    total:    predictions.length,
    overflow: predictions.filter((p) => p.overflow_risk).length,
    critical: predictions.filter((p) => p.priority === 'CRITICAL').length,
    high:     predictions.filter((p) => p.priority === 'HIGH').length,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">AI PREDICTIONS</h1>
          <p className="text-xs text-txt-secondary mt-1">Linear regression fill-level forecasting · Model v1</p>
        </div>
        <button onClick={handleTrain} disabled={training} className="btn btn-primary">
          {training ? <span className="spinner" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
          {training ? 'TRAINING...' : 'RETRAIN MODEL'}
        </button>
      </div>

      {/* Accuracy stats */}
      {accuracy && accuracy.total_verified > 0 && (
        <div className="card card-accent-green">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-black text-accent-green">{accuracy.accuracy_rate}%</div>
              <div className="text-[10px] text-txt-secondary mt-1">ACCURACY RATE</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-accent-blue">{accuracy.total_verified}</div>
              <div className="text-[10px] text-txt-secondary mt-1">VERIFIED PREDICTIONS</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-accent-gold">{accuracy.mean_absolute_error_pct}%</div>
              <div className="text-[10px] text-txt-secondary mt-1">MEAN ABS ERROR</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-txt-primary">{accuracy.model_version || 'linear_v1'}</div>
              <div className="text-[10px] text-txt-secondary mt-1">MODEL VERSION</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all',      label: `All (${counts.total})` },
          { key: 'overflow', label: `Overflow Risk (${counts.overflow})` },
          { key: 'critical', label: `Critical (${counts.critical})` },
          { key: 'high',     label: `High (${counts.high})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`btn text-xs py-2 px-4 ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Predictions grid */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex justify-center mb-3"><svg className="w-12 h-12 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg></div>
          <p className="text-txt-secondary">No predictions match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p, i) => {
            const style = PRIORITY_STYLE[p.priority] || PRIORITY_STYLE.LOW
            return (
              <motion.div
                key={p.id || i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card"
                style={{ borderLeft: `3px solid ${style.border}`, background: style.bg }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-sm font-bold text-accent-blue">{p.bin_id}</span>
                  <div className="flex gap-1">
                    <span className={`badge ${style.badge}`}>{p.priority}</span>
                    {p.overflow_risk && <span className="badge badge-red">OVERFLOW</span>}
                  </div>
                </div>

                {/* Fill bars */}
                <div className="space-y-2 mb-3">
                  {[
                    { label: 'Current',  value: p.current_fill,         color: '#94a3b8' },
                    { label: '+6 Hours', value: p.predicted_fill_6hrs,  color: p.predicted_fill_6hrs >= 90 ? '#ef4444' : '#f59e0b' },
                    { label: '+12 Hours',value: p.predicted_fill_12hrs, color: p.predicted_fill_12hrs >= 90 ? '#ef4444' : '#0ea5e9' },
                  ].map((bar) => (
                    <div key={bar.label}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-txt-secondary">{bar.label}</span>
                        <span style={{ color: bar.color }} className="font-bold">{bar.value ?? '—'}%</span>
                      </div>
                      <div className="fill-bar">
                        <div className="fill-bar-inner" style={{ width: `${bar.value || 0}%`, background: bar.color }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-txt-secondary border-t border-border-dim pt-2">
                  <div className="flex justify-between">
                    <span>Confidence</span>
                    <span className="text-accent-green font-semibold">{((p.confidence || 0) * 100).toFixed(0)}%</span>
                  </div>
                  {p.time_to_overflow_mins && (
                    <div className="flex justify-between mt-1">
                      <span>Time to overflow</span>
                      <span className="text-critical font-semibold">{p.time_to_overflow_mins} min</span>
                    </div>
                  )}
                  {p.recommended_action && (
                    <div className="mt-2 text-[10px] bg-bg-secondary rounded px-2 py-1 border border-border-dim flex items-center gap-1">
                      <svg className="w-3 h-3 text-accent-blue shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {p.recommended_action}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
