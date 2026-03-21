import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { citizensAPI } from '../../services/api'
import { useAuth } from '../../auth/AuthContext'
import toast from 'react-hot-toast'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const { user } = useAuth()
  const [board,   setBoard]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    citizensAPI.getLeaderboard(50)
      .then((r) => setBoard(r.data?.leaderboard || []))
      .catch(() => toast.error('Failed to load leaderboard'))
      .finally(() => setLoading(false))
  }, [])

  const myRank = board.findIndex((e) => e.user_id === user?.id) + 1

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">LEADERBOARD</h1>
        <p className="text-xs text-txt-secondary mt-1">Top recyclers in your city</p>
      </div>

      {/* My rank */}
      {myRank > 0 && (
        <div className="card card-accent-gold text-center py-4">
          <div className="text-3xl font-black text-accent-gold">#{myRank}</div>
          <div className="text-xs text-txt-secondary mt-1">Your current rank</div>
        </div>
      )}

      {/* Top 3 podium */}
      {board.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {[board[1], board[0], board[2]].map((entry, i) => {
            const rank = i === 1 ? 1 : i === 0 ? 2 : 3
            const heights = ['h-24', 'h-32', 'h-20']
            const isMe = entry?.user_id === user?.id
            return (
              <motion.div
                key={rank}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`card text-center flex flex-col items-center justify-end ${heights[i]} ${isMe ? 'border-accent-gold' : ''}`}
                style={{ borderTop: rank === 1 ? '2px solid #f59e0b' : rank === 2 ? '2px solid #94a3b8' : '2px solid #cd7f32' }}
              >
                <div className="text-3xl mb-1">{MEDALS[rank - 1]}</div>
                <div className="text-xs font-bold text-txt-primary truncate w-full px-2">{entry?.full_name || 'Anonymous'}</div>
                <div className="text-accent-gold font-black text-sm">🪙 {(entry?.token_balance || 0).toLocaleString()}</div>
                <div className="text-[10px] text-txt-secondary">#{rank}</div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Full table */}
      <div className="card card-accent-blue">
        <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">FULL RANKINGS</h3>
        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner spinner-lg" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Citizen</th>
                  <th>Tokens</th>
                  <th>Total Earned</th>
                  <th>Recycling Count</th>
                  <th>Streak</th>
                </tr>
              </thead>
              <tbody>
                {board.map((entry, i) => {
                  const isMe = entry.user_id === user?.id
                  return (
                    <tr key={i} style={isMe ? { background: 'rgba(245,158,11,0.08)' } : {}}>
                      <td>
                        <span className="font-bold">
                          {i < 3 ? MEDALS[i] : `#${i + 1}`}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-accent-green/20 flex items-center justify-center text-xs font-bold text-accent-green">
                            {entry.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className={isMe ? 'text-accent-gold font-bold' : ''}>
                            {entry.full_name || 'Anonymous'} {isMe && '(You)'}
                          </span>
                        </div>
                      </td>
                      <td className="font-black text-accent-gold">🪙 {(entry.token_balance || 0).toLocaleString()}</td>
                      <td className="text-accent-green">{(entry.total_earned || 0).toLocaleString()}</td>
                      <td>{entry.recycling_count || 0}</td>
                      <td>{entry.streak_days ? `🔥 ${entry.streak_days}d` : '—'}</td>
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
