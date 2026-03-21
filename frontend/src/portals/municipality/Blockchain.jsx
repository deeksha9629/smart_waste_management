import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { blockchainAPI } from '../../services/api'
import toast from 'react-hot-toast'

export default function Blockchain() {
  const [transactions, setTransactions] = useState([])
  const [stats,        setStats]        = useState(null)
  const [verifyId,     setVerifyId]     = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [verifying,    setVerifying]    = useState(false)
  const [typeFilter,   setTypeFilter]   = useState('')

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([
        blockchainAPI.getTransactions(100, typeFilter || undefined),
        blockchainAPI.getStats(),
      ])
      setTransactions(t.data?.transactions || [])
      setStats(s.data)
    } catch { toast.error('Failed to load blockchain data') }
    finally { setLoading(false) }
  }, [typeFilter])

  useEffect(() => { load() }, [load])

  const handleVerify = async () => {
    if (!verifyId.trim()) return
    setVerifying(true)
    setVerifyResult(null)
    try {
      const res = await blockchainAPI.verifyEvent(verifyId.trim())
      setVerifyResult(res.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const TX_TYPES = ['', 'collection_event', 'recycling_intake', 'violation']

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">BLOCKCHAIN LEDGER</h1>
        <p className="text-xs text-txt-secondary mt-1">Immutable SHA-256 transaction log · All events verified on-chain</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Transactions', value: stats.total_transactions,  color: 'text-accent-blue'   },
            { label: 'Today',              value: stats.transactions_today,  color: 'text-accent-green'  },
            { label: 'Network',            value: stats.network?.split(' ')[0], color: 'text-accent-gold' },
            { label: 'Status',             value: 'CONFIRMED',               color: 'text-accent-green'  },
          ].map((s) => (
            <div key={s.label} className="card card-accent-blue text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-txt-secondary mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Verify panel */}
      <div className="card card-accent-purple">
        <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-3">VERIFY EVENT</h3>
        <div className="flex gap-3">
          <input
            type="text"
            className="input flex-1"
            placeholder="Enter Event ID (e.g. EVT-XXXXXXXXXX)"
            value={verifyId}
            onChange={(e) => setVerifyId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
          />
          <button onClick={handleVerify} disabled={verifying} className="btn btn-primary px-6">
            {verifying ? <span className="spinner" /> : '🔍'}
            {verifying ? 'VERIFYING...' : 'VERIFY'}
          </button>
        </div>
        {verifyResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-4 rounded-lg border" style={{ borderColor: verifyResult.verified ? '#10b981' : '#ef4444', background: verifyResult.verified ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{verifyResult.verified ? '✅' : '❌'}</span>
              <span className={`font-bold text-sm ${verifyResult.verified ? 'text-accent-green' : 'text-critical'}`}>
                {verifyResult.verified ? 'VERIFIED — Hash matches blockchain record' : 'INVALID — Hash mismatch detected'}
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex gap-2">
                <span className="text-txt-secondary w-32">Stored Hash:</span>
                <span className="hash-text">{verifyResult.stored_hash}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-txt-secondary w-32">Computed Hash:</span>
                <span className="hash-text">{verifyResult.computed_hash}</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {TX_TYPES.map((t) => (
          <button
            key={t || 'all'}
            onClick={() => setTypeFilter(t)}
            className={`btn text-xs py-2 px-4 ${typeFilter === t ? 'btn-primary' : 'btn-ghost'}`}
          >
            {t || 'All Types'}
          </button>
        ))}
      </div>

      {/* Transactions table */}
      <div className="card card-accent-blue">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary">TRANSACTION LOG</h3>
          <span className="badge badge-blue">{transactions.length} records</span>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner spinner-lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>TX Hash</th>
                  <th>Type</th>
                  <th>Related ID</th>
                  <th>Status</th>
                  <th>Recorded At</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-txt-secondary py-8">No transactions found</td></tr>
                ) : transactions.map((tx, i) => (
                  <tr key={i}>
                    <td>
                      <span className="hash-text truncate-hash block" title={tx.tx_hash}>{tx.tx_hash}</span>
                    </td>
                    <td><span className="badge badge-blue">{tx.transaction_type?.replace(/_/g, ' ')}</span></td>
                    <td className="mono text-xs">{tx.related_id?.slice(0, 20)}...</td>
                    <td><span className="badge badge-green">{tx.status}</span></td>
                    <td className="text-txt-secondary text-xs">
                      {tx.recorded_at ? format(new Date(tx.recorded_at), 'MMM d, HH:mm:ss') : '—'}
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
