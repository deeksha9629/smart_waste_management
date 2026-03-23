import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { citizensAPI } from '../../services/api'
import { useAuth } from '../../auth/AuthContext'
import toast from 'react-hot-toast'

const MEDALS = [
  <svg className="w-7 h-7 text-accent-gold" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  <svg className="w-7 h-7 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  <svg className="w-7 h-7 text-amber-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
]

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
                <div className="text-accent-gold font-black text-sm flex items-center gap-1 justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {(entry?.token_balance || 0).toLocaleString()}
                </div>
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
                      <td className="font-black text-accent-gold">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {(entry.token_balance || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="text-accent-green">{(entry.total_earned || 0).toLocaleString()}</td>
                      <td>{entry.recycling_count || 0}</td>
                      <td>{entry.streak_days ? <span className="flex items-center gap-1"><svg className="w-3.5 h-3.5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>{entry.streak_days}d</span> : '—'}</td>
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
