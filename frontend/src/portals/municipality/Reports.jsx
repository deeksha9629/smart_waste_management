import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { municipalityAPI } from '../../services/api'
import toast from 'react-hot-toast'

const STATUS_BADGE  = { pending: 'badge-gold', investigating: 'badge-blue', resolved: 'badge-green', rejected: 'badge-gray' }
const TYPE_ICON     = { illegal_dumping: '🚫', bin_overflow: '⚠️', damaged_bin: '🗑️', missed_collection: '🚛', general_complaint: '📝' }
const VALID_STATUSES = ['pending', 'investigating', 'resolved', 'rejected']

export default function MunicipalReports() {
  const [reports,   setReports]   = useState([])
  const [filter,    setFilter]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const [updating,  setUpdating]  = useState(null)
  const [search,    setSearch]    = useState('')

  const load = useCallback(async () => {
    try {
      const res = await municipalityAPI.getReports(filter || undefined)
      setReports(res.data?.reports || [])
    } catch { toast.error('Failed to load reports') }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleStatusUpdate = async (reportId, status) => {
    setUpdating(reportId)
    try {
      await municipalityAPI.updateReportStatus(reportId, status)
      toast.success(`Report marked as ${status}`)
      load()
    } catch { toast.error('Failed to update report') }
    finally { setUpdating(null) }
  }

  const counts = {
    total:         reports.length,
    pending:       reports.filter((r) => r.status === 'pending').length,
    investigating: reports.filter((r) => r.status === 'investigating').length,
    resolved:      reports.filter((r) => r.status === 'resolved').length,
  }

  const filtered = search
    ? reports.filter((r) =>
        r.report_id?.toLowerCase().includes(search.toLowerCase()) ||
        r.description?.toLowerCase().includes(search.toLowerCase()) ||
        r.report_type?.toLowerCase().includes(search.toLowerCase())
      )
    : reports

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">CITIZEN REPORTS</h1>
          <p className="text-xs text-txt-secondary mt-1">Manage and respond to citizen waste reports</p>
        </div>
        <button onClick={load} className="btn btn-ghost text-xs py-2">
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Reports',  value: counts.total,         color: 'text-txt-primary'   },
          { label: 'Pending',        value: counts.pending,       color: 'text-accent-gold'   },
          { label: 'Investigating',  value: counts.investigating, color: 'text-accent-blue'   },
          { label: 'Resolved',       value: counts.resolved,      color: 'text-accent-green'  },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-txt-secondary mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          {['', ...VALID_STATUSES].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setFilter(s)}
              className={`btn text-xs py-2 px-4 ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <input
            type="text"
            className="input text-xs py-2 w-56"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner spinner-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-txt-secondary">No reports found{filter ? ` with status "${filter}"` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report, i) => (
            <motion.div
              key={report.id || i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card"
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl mt-0.5">{TYPE_ICON[report.report_type] || '📝'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-accent-blue">{report.report_id}</span>
                    <span className={`badge ${STATUS_BADGE[report.status] || 'badge-gray'}`}>{report.status}</span>
                    <span className="badge badge-gray">{report.report_type?.replace(/_/g, ' ')}</span>
                    {report.priority && (
                      <span className={`badge ${report.priority === 'high' ? 'badge-red' : report.priority === 'medium' ? 'badge-gold' : 'badge-blue'}`}>
                        {report.priority}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-txt-primary mb-1">{report.description || 'No description'}</p>
                  <div className="flex flex-wrap gap-4 text-[10px] text-txt-secondary">
                    {report.address && <span>📍 {report.address}</span>}
                    {report.bin_id  && <span>🗑️ Bin: {report.bin_id}</span>}
                    <span>🕐 {report.created_at ? format(new Date(report.created_at), 'MMM d, yyyy HH:mm') : '—'}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  {report.status === 'pending' && (
                    <button
                      onClick={() => handleStatusUpdate(report.report_id, 'investigating')}
                      disabled={updating === report.report_id}
                      className="btn btn-primary text-[10px] py-1.5 px-3"
                    >
                      {updating === report.report_id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '🔍 Investigate'}
                    </button>
                  )}
                  {report.status === 'investigating' && (
                    <button
                      onClick={() => handleStatusUpdate(report.report_id, 'resolved')}
                      disabled={updating === report.report_id}
                      className="btn btn-success text-[10px] py-1.5 px-3"
                    >
                      {updating === report.report_id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '✓ Resolve'}
                    </button>
                  )}
                  {['pending', 'investigating'].includes(report.status) && (
                    <button
                      onClick={() => handleStatusUpdate(report.report_id, 'rejected')}
                      disabled={updating === report.report_id}
                      className="btn btn-ghost text-[10px] py-1.5 px-3"
                    >
                      ✕ Reject
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
