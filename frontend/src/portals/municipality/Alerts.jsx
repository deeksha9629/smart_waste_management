import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { municipalityAPI } from '../../services/api'
import toast from 'react-hot-toast'

const SEV_BADGE = { critical: 'badge-red', high: 'badge-orange', medium: 'badge-gold', low: 'badge-blue' }
const TYPE_ICON = {
  bin_critical:         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  bin_overflow:         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  vehicle_breakdown:    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h10l2-2z" /></svg>,
  illegal_dumping:      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  compliance_violation: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  sensor_failure:       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>,
  plant_full:           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  collection_delayed:   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  citizen_report:       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>,
}

export default function Alerts() {
  const [alerts,    setAlerts]    = useState([])
  const [severity,  setSeverity]  = useState('')
  const [loading,   setLoading]   = useState(true)
  const [resolving, setResolving] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await municipalityAPI.getAlerts(severity || undefined)
      setAlerts(res.data?.alerts || [])
    } catch { toast.error('Failed to load alerts') }
    finally { setLoading(false) }
  }, [severity])

  useEffect(() => { load() }, [load])

  const handleResolve = async (id) => {
    setResolving(id)
    try {
      await municipalityAPI.resolveAlert(id)
      toast.success('Alert resolved')
      load()
    } catch { toast.error('Failed to resolve alert') }
    finally { setResolving(null) }
  }

  const counts = {
    total:    alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    high:     alerts.filter((a) => a.severity === 'high').length,
    medium:   alerts.filter((a) => a.severity === 'medium').length,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">ALERTS MANAGEMENT</h1>
        <p className="text-xs text-txt-secondary mt-1">All unresolved system alerts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Open',  value: counts.total,    color: 'text-txt-primary' },
          { label: 'Critical',    value: counts.critical, color: 'text-critical'    },
          { label: 'High',        value: counts.high,     color: 'text-warning'     },
          { label: 'Medium',      value: counts.medium,   color: 'text-accent-gold' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-txt-secondary mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Severity filter */}
      <div className="flex gap-2">
        {['', 'critical', 'high', 'medium', 'low'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setSeverity(s)}
            className={`btn text-xs py-2 px-4 ${severity === s ? 'btn-primary' : 'btn-ghost'}`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner spinner-lg" /></div>
      ) : alerts.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex justify-center mb-3"><svg className="w-12 h-12 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <p className="text-txt-secondary">No unresolved alerts{severity ? ` with severity "${severity}"` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => (
            <motion.div
              key={alert.id || i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`alert-item ${alert.severity}`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bg-secondary border border-border-dim">{TYPE_ICON[alert.alert_type] || <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-txt-primary">{alert.title}</span>
                  <span className={`badge ${SEV_BADGE[alert.severity] || 'badge-gray'}`}>{alert.severity}</span>
                  <span className="badge badge-gray">{alert.alert_type?.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-xs text-txt-secondary">{alert.message}</p>
                <div className="flex gap-4 mt-1 text-[10px] text-txt-secondary">
                  {alert.bin_id     && <span>Bin: <strong className="text-txt-primary">{alert.bin_id}</strong></span>}
                  {alert.vehicle_id && <span>Vehicle: <strong className="text-txt-primary">{alert.vehicle_id}</strong></span>}
                  <span>{alert.created_at ? format(new Date(alert.created_at), 'MMM d, HH:mm') : '—'}</span>
                </div>
              </div>
              <button
                onClick={() => handleResolve(alert.id)}
                disabled={resolving === alert.id}
                className="btn btn-success text-xs py-1.5 px-4 shrink-0"
              >
                {resolving === alert.id ? <span className="spinner" /> : '✓'}
                Resolve
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
