import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { citizensAPI } from '../../services/api'
import toast from 'react-hot-toast'

const BusIcon = () => <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17a2 2 0 11-4 0 2 2 0 014 0zM20 17a2 2 0 11-4 0 2 2 0 014 0zM3 10h18M3 6h18M3 14h18M5 6v12M19 6v12" /></svg>
const TreeIcon = () => <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
const BoltIcon = () => <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
const ShoppingIcon = () => <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
const LightbulbIcon = () => <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
const TrainIcon = () => <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>

const REDEMPTIONS = [
  { type: 'transit_pass_day',       label: 'Day Transit Pass',     cost: 200,  Icon: BusIcon,      desc: '1-day unlimited bus/metro' },
  { type: 'tree_planting_donation', label: 'Plant a Tree',         cost: 100,  Icon: TreeIcon,     desc: 'Donate to city reforestation' },
  { type: 'utility_discount_5',     label: '5% Utility Discount',  cost: 500,  Icon: BoltIcon,     desc: 'Applied to next electricity bill' },
  { type: 'grocery_voucher_10',     label: '₹500 Grocery Voucher',  cost: 800,  Icon: ShoppingIcon, desc: 'Valid at partner supermarkets' },
  { type: 'utility_discount_10',    label: '10% Utility Discount', cost: 900,  Icon: LightbulbIcon,desc: 'Applied to next electricity bill' },
  { type: 'transit_pass_week',      label: 'Weekly Transit Pass',  cost: 1200, Icon: TrainIcon,    desc: '7-day unlimited public transport' },
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
        <div className="flex justify-center mb-2"><svg className="w-12 h-12 text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
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
                <div className="mb-2 text-accent-gold"><opt.Icon /></div>
                <div className="text-sm font-bold text-txt-primary mb-1">{opt.label}</div>
                <div className="text-xs text-txt-secondary mb-3">{opt.desc}</div>
                <div className="flex items-center justify-between">
                  <span className="text-accent-gold font-black flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{opt.cost.toLocaleString()}</span>
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
