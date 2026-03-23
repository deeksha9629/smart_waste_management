import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { recyclingAPI } from '../../services/api'
import toast from 'react-hot-toast'

const PIPELINE = ['received', 'sorting', 'processing', 'completed', 'rejected']

const STAGE_STYLE = {
  received:   { color: '#0ea5e9', badge: 'badge-blue',   icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> },
  sorting:    { color: '#f59e0b', badge: 'badge-gold',   icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg> },
  processing: { color: '#f97316', badge: 'badge-orange', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  completed:  { color: '#10b981', badge: 'badge-green',  icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  rejected:   { color: '#ef4444', badge: 'badge-red',    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
}

export default function Processing() {
  const [intake,   setIntake]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState(null)
  const [view,     setView]     = useState('pipeline') // 'pipeline' | 'table'

  const load = useCallback(async () => {
    try {
      const res = await recyclingAPI.getIntake()
      setIntake(res.data?.intake || [])
    } catch { toast.error('Failed to load processing data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdvance = async (intakeId, currentStatus) => {
    const idx = PIPELINE.indexOf(currentStatus)
    if (idx < 0 || idx >= PIPELINE.length - 2) return // can't advance completed/rejected
    const nextStatus = PIPELINE[idx + 1]
    setUpdating(intakeId)
    try {
      await recyclingAPI.updateIntakeStatus(intakeId, nextStatus)
      toast.success(`${intakeId} → ${nextStatus}`)
      load()
    } catch { toast.error('Failed to update status') }
    finally { setUpdating(null) }
  }

  const handleReject = async (intakeId) => {
    setUpdating(intakeId)
    try {
      await recyclingAPI.updateIntakeStatus(intakeId, 'rejected')
      toast.success(`${intakeId} rejected`)
      load()
    } catch { toast.error('Failed to reject') }
    finally { setUpdating(null) }
  }

  // Group by status
  const byStatus = PIPELINE.reduce((acc, s) => {
    acc[s] = intake.filter((r) => r.processing_status === s)
    return acc
  }, {})

  const totalWeight = intake.reduce((sum, r) => sum + (r.net_weight_kg || 0), 0)

  if (loading) return <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">PROCESSING PIPELINE</h1>
          <p className="text-xs text-txt-secondary mt-1">
            {intake.length} total records · {totalWeight.toFixed(1)} kg total weight
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('pipeline')} className={`btn text-xs py-2 px-4 ${view === 'pipeline' ? 'btn-primary' : 'btn-ghost'}`}>
            Pipeline View
          </button>
          <button onClick={() => setView('table')} className={`btn text-xs py-2 px-4 ${view === 'table' ? 'btn-primary' : 'btn-ghost'}`}>
            Table View
          </button>
          <button onClick={load} className="btn btn-ghost text-xs py-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      {/* Pipeline summary */}
      <div className="grid grid-cols-5 gap-3">
        {PIPELINE.map((stage) => {
          const s = STAGE_STYLE[stage]
          const count = byStatus[stage]?.length || 0
          const weight = byStatus[stage]?.reduce((sum, r) => sum + (r.net_weight_kg || 0), 0) || 0
          return (
            <div
              key={stage}
              className="card text-center"
              style={{ borderTop: `2px solid ${s.color}` }}
            >
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xl font-black" style={{ color: s.color }}>{count}</div>
              <div className="text-[10px] text-txt-secondary capitalize mt-0.5">{stage}</div>
              <div className="text-[9px] text-txt-secondary mt-1">{weight.toFixed(0)} kg</div>
            </div>
          )
        })}
      </div>

      {view === 'pipeline' ? (
        /* Pipeline kanban view */
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {PIPELINE.map((stage) => {
            const s = STAGE_STYLE[stage]
            const records = byStatus[stage] || []
            return (
              <div key={stage} className="card" style={{ borderTop: `2px solid ${s.color}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <span>{s.icon}</span>
                  <span className="text-xs font-bold text-txt-primary capitalize">{stage}</span>
                  <span className={`badge ${s.badge} ml-auto`}>{records.length}</span>
                </div>
                <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 400 }}>
                  {records.length === 0 ? (
                    <p className="text-txt-secondary text-[10px] text-center py-4">Empty</p>
                  ) : records.map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-2.5 rounded-lg border border-border-dim bg-bg-secondary"
                    >
                      <div className="font-mono text-[10px] font-bold text-accent-gold mb-1">{r.intake_id}</div>
                      <div className="text-[10px] text-txt-secondary mb-1">
                        <span className="badge badge-blue text-[9px]">{r.waste_type}</span>
                        {' '}{r.net_weight_kg?.toFixed(1) || '—'} kg
                      </div>
                      {r.quality_grade && (
                        <div className="text-[9px] text-txt-secondary mb-1">
                          Grade: <strong className={r.quality_grade === 'A' ? 'text-accent-green' : r.quality_grade === 'rejected' ? 'text-critical' : 'text-accent-gold'}>{r.quality_grade}</strong>
                        </div>
                      )}
                      {!['completed', 'rejected'].includes(stage) && (
                        <div className="flex gap-1 mt-1.5">
                          <button
                            onClick={() => handleAdvance(r.intake_id, stage)}
                            disabled={updating === r.intake_id}
                            className="btn btn-success text-[9px] py-0.5 px-2 flex-1"
                          >
                            {updating === r.intake_id ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '→ Next'}
                          </button>
                          <button
                            onClick={() => handleReject(r.intake_id)}
                            disabled={updating === r.intake_id}
                            className="btn btn-danger text-[9px] py-0.5 px-2"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Table view */
        <div className="card card-accent-gold">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intake ID</th>
                  <th>Waste Type</th>
                  <th>Net Weight</th>
                  <th>Grade</th>
                  <th>Status</th>
                  <th>Received</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {intake.map((r, i) => {
                  const s = STAGE_STYLE[r.processing_status] || STAGE_STYLE.received
                  const stageIdx = PIPELINE.indexOf(r.processing_status)
                  return (
                    <tr key={i}>
                      <td className="mono">{r.intake_id}</td>
                      <td><span className="badge badge-blue">{r.waste_type}</span></td>
                      <td>{r.net_weight_kg?.toFixed(1) || '—'} kg</td>
                      <td>
                        {r.quality_grade
                          ? <span className={`badge ${r.quality_grade === 'A' ? 'badge-green' : r.quality_grade === 'rejected' ? 'badge-red' : 'badge-gold'}`}>{r.quality_grade}</span>
                          : '—'
                        }
                      </td>
                      <td><span className={`badge ${s.badge}`}>{r.processing_status}</span></td>
                      <td className="text-txt-secondary text-xs">
                        {r.received_at ? format(new Date(r.received_at), 'MMM d, HH:mm') : '—'}
                      </td>
                      <td>
                        {!['completed', 'rejected'].includes(r.processing_status) && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleAdvance(r.intake_id, r.processing_status)}
                              disabled={updating === r.intake_id}
                              className="btn btn-success text-[10px] py-1 px-2"
                            >
                              {updating === r.intake_id ? <span className="spinner" style={{ width: 10, height: 10 }} /> : `→ ${PIPELINE[stageIdx + 1] || ''}`}
                            </button>
                            <button
                              onClick={() => handleReject(r.intake_id)}
                              disabled={updating === r.intake_id}
                              className="btn btn-danger text-[10px] py-1 px-2"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
