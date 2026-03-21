import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { recyclingAPI } from '../../services/api'
import toast from 'react-hot-toast'

export default function RecyclingBlockchainLog() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    recyclingAPI.getBlockchainRecords()
      .then((r) => setRecords(r.data?.records || []))
      .catch(() => toast.error('Failed to load blockchain records'))
      .finally(() => setLoading(false))
  }, [])

  const downloadAudit = () => {
    const csv = [
      ['TX Hash', 'Type', 'Related ID', 'Status', 'Recorded At'].join(','),
      ...records.map((r) => [r.tx_hash, r.transaction_type, r.related_id, r.status, r.recorded_at].join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `recycling-audit-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">BLOCKCHAIN LOG</h1>
          <p className="text-xs text-txt-secondary mt-1">Immutable audit trail for all recycling intake events</p>
        </div>
        <button onClick={downloadAudit} className="btn btn-gold text-xs">
          ⬇️ Download Audit CSV
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Records',  value: records.length,                                          color: 'text-accent-gold'  },
          { label: 'Confirmed',      value: records.filter((r) => r.status === 'confirmed').length,  color: 'text-accent-green' },
          { label: 'Today',          value: records.filter((r) => r.recorded_at?.startsWith(new Date().toISOString().slice(0,10))).length, color: 'text-accent-blue' },
        ].map((s) => (
          <div key={s.label} className="card card-accent-gold text-center">
            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-txt-secondary mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card card-accent-gold">
        <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">RECYCLING INTAKE TRANSACTIONS</h3>
        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner spinner-lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>TX Hash</th>
                  <th>Related ID</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Recorded At</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-txt-secondary py-8">No blockchain records found</td></tr>
                ) : records.map((r, i) => (
                  <tr key={i}>
                    <td><span className="hash-text truncate-hash block" title={r.tx_hash}>{r.tx_hash}</span></td>
                    <td className="mono text-xs">{r.related_id?.slice(0, 20)}...</td>
                    <td><span className="badge badge-green">{r.status}</span></td>
                    <td className="text-txt-secondary text-xs">
                      {r.data ? `${r.data.waste_type || ''} ${r.data.net_weight_kg ? r.data.net_weight_kg + 'kg' : ''}` : '—'}
                    </td>
                    <td className="text-txt-secondary text-xs">
                      {r.recorded_at ? format(new Date(r.recorded_at), 'MMM d, HH:mm:ss') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
