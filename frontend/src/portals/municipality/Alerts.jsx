import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { municipalityAPI } from '../../services/api'
import toast from 'react-hot-toast'

const SEV_BADGE = { critical: 'badge-red', high: 'badge-orange', medium: 'badge-gold', low: 'badge-blue' }
const TYPE_ICON = {
  bin_critical: '🗑️', bin_overflow: '⚠️', vehicle_breakdown: '🚛',
  illegal_dumping: '🚫', compliance_violation: '📋', sensor_failure: '📡',
  plant_full: '🏭', collection_delayed: '⏰',
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
          <div className="text-4xl mb-3">✅</div>
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
              <div className="text-2xl">{TYPE_ICON[alert.alert_type] || '⚠️'}</div>
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
