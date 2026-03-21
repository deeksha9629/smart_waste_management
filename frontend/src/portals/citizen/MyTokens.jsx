import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { citizensAPI } from '../../services/api'
import toast from 'react-hot-toast'

const REDEMPTIONS = [
  { type: 'transit_pass_day',    label: 'Day Transit Pass',      cost: 200,  icon: '🚌', desc: '1-day unlimited bus/metro' },
  { type: 'tree_planting_donation', label: 'Plant a Tree',       cost: 100,  icon: '🌳', desc: 'Donate to city reforestation' },
  { type: 'utility_discount_5', label: '5% Utility Discount',    cost: 500,  icon: '⚡', desc: 'Applied to next electricity bill' },
  { type: 'grocery_voucher_10', label: '$10 Grocery Voucher',     cost: 800,  icon: '🛒', desc: 'Valid at partner supermarkets' },
  { type: 'utility_discount_10',label: '10% Utility Discount',   cost: 900,  icon: '💡', desc: 'Applied to next electricity bill' },
  { type: 'transit_pass_week',  label: 'Weekly Transit Pass',    cost: 1200, icon: '🚇', desc: '7-day unlimited public transport' },
]

export default function MyTokens() {
  const [wallet,       setWallet]       = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [redeeming,    setRedeeming]    = useState(null)

  const load = async () => {
    try {
      const [w, h] = await Promise.all([citizensAPI.getMyTokens(), citizensAPI.getHistory()])
      setWallet(w.data)
      setTransactions(h.data?.transactions || [])
    } catch { toast.error('Failed to load wallet') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleRedeem = async (option) => {
    if ((wallet?.token_balance || 0) < option.cost) {
      toast.error(`Insufficient tokens. Need ${option.cost}, have ${wallet?.token_balance || 0}`)
      return
    }
    setRedeeming(option.type)
    try {
      await citizensAPI.redeem({ redemption_type: option.type, amount: option.cost })
      toast.success(`${option.label} redeemed! 🎉`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Redemption failed')
    } finally {
      setRedeeming(null)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">TOKEN WALLET</h1>

      {/* Balance card */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card card-accent-gold text-center py-8">
        <div className="text-5xl mb-2">🪙</div>
        <div className="text-5xl font-black text-accent-gold glow-gold mb-1">
          {(wallet?.token_balance || 0).toLocaleString()}
        </div>
        <div className="text-xs text-txt-secondary tracking-widest mb-4">AVAILABLE TOKENS</div>
        <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
          {[
            { label: 'Total Earned',   value: wallet?.total_earned   || 0, color: 'text-accent-green' },
            { label: 'Total Redeemed', value: wallet?.total_redeemed || 0, color: 'text-critical'     },
            { label: 'Recycling Count',value: wallet?.recycling_count|| 0, color: 'text-accent-blue'  },
          ].map((s) => (
            <div key={s.label}>
              <div className={`text-xl font-black ${s.color}`}>{s.value.toLocaleString()}</div>
              <div className="text-[10px] text-txt-secondary">{s.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Redemption options */}
      <div>
        <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-3">REDEEM TOKENS</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REDEMPTIONS.map((opt, i) => {
            const canAfford = (wallet?.token_balance || 0) >= opt.cost
            return (
              <motion.div
                key={opt.type}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`card ${canAfford ? 'card-accent-gold' : ''}`}
                style={{ opacity: canAfford ? 1 : 0.6 }}
              >
                <div className="text-3xl mb-2">{opt.icon}</div>
                <div className="text-sm font-bold text-txt-primary mb-1">{opt.label}</div>
                <div className="text-xs text-txt-secondary mb-3">{opt.desc}</div>
                <div className="flex items-center justify-between">
                  <span className="text-accent-gold font-black">🪙 {opt.cost.toLocaleString()}</span>
                  <button
                    onClick={() => handleRedeem(opt)}
                    disabled={!canAfford || redeeming === opt.type}
                    className={`btn text-xs py-1.5 px-4 ${canAfford ? 'btn-gold' : 'btn-ghost'}`}
                  >
                    {redeeming === opt.type ? <span className="spinner" /> : 'Redeem'}
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Transaction history */}
      <div className="card card-accent-blue">
        <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">TRANSACTION HISTORY</h3>
        {transactions.length === 0 ? (
          <p className="text-txt-secondary text-sm text-center py-6">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`badge ${tx.action === 'earned' || tx.action === 'bonus' ? 'badge-green' : tx.action === 'redeemed' ? 'badge-red' : 'badge-blue'}`}>
                        {tx.action}
                      </span>
                    </td>
                    <td className={`font-bold ${tx.action === 'redeemed' ? 'text-critical' : 'text-accent-green'}`}>
                      {tx.action === 'redeemed' ? '-' : '+'}{tx.amount}
                    </td>
                    <td className="font-mono">{tx.balance_after}</td>
                    <td className="text-txt-secondary text-xs">{tx.description || '—'}</td>
                    <td className="text-txt-secondary text-xs">
                      {tx.created_at ? format(new Date(tx.created_at), 'MMM d, HH:mm') : '—'}
                    </td>
                    <td>
                      {tx.blockchain_hash
                        ? <span className="hash-text truncate-hash block" title={tx.blockchain_hash}>{tx.blockchain_hash}</span>
                        : <span className="text-txt-secondary text-xs">—</span>
                      }
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
