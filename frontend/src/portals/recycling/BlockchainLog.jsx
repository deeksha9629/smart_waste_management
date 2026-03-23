import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { recyclingAPI } from '../../services/api'
import toast from 'react-hot-toast'

const EVENT_BADGE = {
  intake_received:  { cls: 'badge-blue',   label: 'RECEIVED'  },
  intake_completed: { cls: 'badge-green',  label: 'COMPLETED' },
  intake_rejected:  { cls: 'badge-red',    label: 'REJECTED'  },
}

function HashCell({ hash }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="font-mono text-[10px] text-accent-gold truncate" title={hash}>
        {hash?.slice(0, 18)}…{hash?.slice(-6)}
      </span>
      <button onClick={copy} className="shrink-0 text-txt-secondary hover:text-accent-blue transition-colors">
        {copied
          ? <svg className="w-3.5 h-3.5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        }
      </button>
    </div>
  )
}

export default function RecyclingBlockchainLog() {
  const [records,    setRecords]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [verifying,  setVerifying]  = useState(null)
  const [filterEvt,  setFilterEvt]  = useState('')

  const load = useCallback(async () => {
    try {
      const res = await recyclingAPI.getBlockchainRecords()
      setRecords(res.data?.records || [])
    } catch {
      toast.error('Failed to load blockchain records')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleVerify = async (record) => {
    setVerifying(record.id)
    try {
      // Re-compute hash client-side from stored data and compare
      const data = record.data || {}
      const recomputed = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(
          JSON.stringify(
            Object.fromEntries(Object.entries(data).sort()),
            null,
            undefined
          )
        )
      )
      const hex = '0x' + Array.from(new Uint8Array(recomputed))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const valid = hex === record.tx_hash
      if (valid) {
        toast.success(`${record.data?.intake_id || record.related_id} — hash verified ✓`)
      } else {
        toast.error(`Hash mismatch — record may be tampered`)
      }
    } catch {
      toast.error('Verification failed')
    } finally {
      setVerifying(null)
    }
  }

  const downloadAudit = () => {
    const rows = [
      ['Intake ID', 'Event', 'Waste Type', 'Gross (kg)', 'Net (kg)', 'Grade', 'Vehicle', 'TX Hash', 'Status', 'Recorded At'],
      ...records.map((r) => {
        const d = r.data || {}
        return [
          d.intake_id || r.related_id,
          d.event || '',
          d.waste_type || '',
          d.gross_weight_kg || '',
          d.net_weight_kg || '',
          d.quality_grade || '',
          d.vehicle_id || '',
          r.tx_hash,
          r.status,
          r.recorded_at,
        ]
      }),
    ]
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `recycling-blockchain-${Date.now()}.csv`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const today = new Date().toISOString().slice(0, 10)
  const stats = {
    total:     records.length,
    confirmed: records.filter((r) => r.status === 'confirmed').length,
    today:     records.filter((r) => r.recorded_at?.startsWith(today)).length,
    completed: records.filter((r) => r.data?.event === 'intake_completed').length,
  }

  const filtered = filterEvt
    ? records.filter((r) => r.data?.event === filterEvt)
    : records

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">BLOCKCHAIN AUDIT LOG</h1>
          <p className="text-xs text-txt-secondary mt-1">
            Immutable SHA-256 audit trail · Every intake event is cryptographically recorded
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn btn-ghost text-xs flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button onClick={downloadAudit} className="btn btn-gold text-xs flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Records',  value: stats.total,     color: 'text-accent-gold'  },
          { label: 'Confirmed',      value: stats.confirmed, color: 'text-accent-green' },
          { label: 'Completed',      value: stats.completed, color: 'text-accent-blue'  },
          { label: 'Today',          value: stats.today,     color: 'text-accent-gold'  },
        ].map((s) => (
          <div key={s.label} className="card card-accent-gold text-center">
            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-txt-secondary mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Workflow legend */}
      <div className="card card-accent-blue flex flex-wrap items-center gap-6 py-3">
        <span className="text-xs font-bold text-txt-secondary">WORKFLOW:</span>
        {[
          { event: 'intake_received',  label: 'Intake Received',  color: '#0ea5e9', desc: 'Logged when waste arrives' },
          { event: 'intake_completed', label: 'Processing Done',  color: '#10b981', desc: 'Logged when processing completes' },
          { event: 'intake_rejected',  label: 'Intake Rejected',  color: '#ef4444', desc: 'Logged when waste is rejected' },
        ].map((w) => (
          <div key={w.event} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: w.color }} />
            <div>
              <div className="text-xs font-semibold text-txt-primary">{w.label}</div>
              <div className="text-[10px] text-txt-secondary">{w.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { val: '',                  label: 'All Events'       },
          { val: 'intake_received',   label: 'Received'         },
          { val: 'intake_completed',  label: 'Completed'        },
          { val: 'intake_rejected',   label: 'Rejected'         },
        ].map((f) => (
          <button
            key={f.val || 'all'}
            onClick={() => setFilterEvt(f.val)}
            className={`btn text-xs py-2 px-4 ${filterEvt === f.val ? 'btn-primary' : 'btn-ghost'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card card-accent-gold">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary">
            TRANSACTION RECORDS
          </h3>
          <span className="badge badge-gold">{filtered.length} records</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner spinner-lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Intake ID</th>
                  <th>Event</th>
                  <th>Waste Type</th>
                  <th>Weight</th>
                  <th>Grade</th>
                  <th>Vehicle</th>
                  <th>TX Hash</th>
                  <th>Status</th>
                  <th>Recorded</th>
                  <th>Verify</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center text-txt-secondary py-8">
                      No blockchain records found
                    </td>
                  </tr>
                ) : filtered.map((r, i) => {
                  const d = r.data || {}
                  const evtStyle = EVENT_BADGE[d.event] || { cls: 'badge-gray', label: d.event || '—' }
                  return (
                    <tr key={r.id || i}>
                      <td className="mono text-xs">{d.intake_id || r.related_id?.slice(0, 12) || '—'}</td>
                      <td>
                        <span className={`badge ${evtStyle.cls}`}>{evtStyle.label}</span>
                      </td>
                      <td>
                        {d.waste_type
                          ? <span className="badge badge-blue">{d.waste_type}</span>
                          : '—'
                        }
                      </td>
                      <td className="text-xs">
                        {d.gross_weight_kg != null
                          ? <span>{d.gross_weight_kg} kg{d.net_weight_kg ? ` / ${d.net_weight_kg} kg net` : ''}</span>
                          : '—'
                        }
                      </td>
                      <td>
                        {d.quality_grade
                          ? <span className={`badge ${d.quality_grade === 'A' ? 'badge-green' : d.quality_grade === 'rejected' ? 'badge-red' : 'badge-gold'}`}>
                              {d.quality_grade}
                            </span>
                          : '—'
                        }
                      </td>
                      <td className="mono text-xs">{d.vehicle_id || '—'}</td>
                      <td><HashCell hash={r.tx_hash} /></td>
                      <td>
                        <span className={`badge ${r.status === 'confirmed' ? 'badge-green' : 'badge-gray'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="text-txt-secondary text-xs whitespace-nowrap">
                        {r.recorded_at ? format(new Date(r.recorded_at), 'MMM d, HH:mm:ss') : '—'}
                      </td>
                      <td>
                        <button
                          onClick={() => handleVerify(r)}
                          disabled={verifying === r.id}
                          className="btn btn-ghost text-[10px] py-1 px-2"
                          title="Verify hash integrity"
                        >
                          {verifying === r.id
                            ? <span className="spinner" style={{ width: 12, height: 12 }} />
                            : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                          }
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
