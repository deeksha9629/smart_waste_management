import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { municipalityAPI } from '../../services/api'
import toast from 'react-hot-toast'

const STATUS_BADGE  = { pending: 'badge-gold', investigating: 'badge-blue', resolved: 'badge-green', rejected: 'badge-gray' }
const TYPE_ICON = {
  illegal_dumping:   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  bin_overflow:      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  damaged_bin:       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  missed_collection: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h10l2-2z" /></svg>,
  general_complaint: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
}
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
        <button onClick={load} className="btn btn-ghost text-xs py-2 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
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
          <div className="flex justify-center mb-3"><svg className="w-12 h-12 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
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
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bg-secondary border border-border-dim mt-0.5">{TYPE_ICON[report.report_type] || <svg className="w-5 h-5 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}</div>
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
                    {report.address && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{report.address}</span>}
                    {report.bin_id  && <span>Bin: {report.bin_id}</span>}
                    <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{report.created_at ? format(new Date(report.created_at), 'MMM d, yyyy HH:mm') : '—'}</span>
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
                      {updating === report.report_id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> Investigate</>}
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
