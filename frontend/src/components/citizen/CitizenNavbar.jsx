import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useState, useEffect } from 'react'
import { citizensAPI } from '../../services/api'

const Icon = ({ d, d2 }) => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    {d2 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d2} />}
  </svg>
)

const NAV = [
  { to: '/citizen/home',        icon: <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />, label: 'Home' },
  { to: '/citizen/map',         icon: <Icon d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />, label: 'Map' },
  { to: '/citizen/tokens',      icon: <Icon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />, label: 'Tokens' },
  { to: '/citizen/report',      icon: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />, label: 'Report' },
  { to: '/citizen/leaderboard', icon: <Icon d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />, label: 'Leaderboard' },
]

export default function CitizenNavbar() {
  const { user, logout } = useAuth()
  const [balance, setBalance] = useState(null)

  useEffect(() => {
    citizensAPI.getMyTokens()
      .then((r) => setBalance(r.data?.token_balance ?? 0))
      .catch(() => {})
  }, [])

  return (
    <nav className="topnav justify-between">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className="text-sm font-black tracking-[0.15em] text-txt-primary">SMART-WASTE</span>
      </div>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                  : 'text-txt-secondary hover:text-txt-primary hover:bg-bg-card'
              }`
            }
          >
            <span>{item.icon}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Right: token balance + avatar */}
      <div className="flex items-center gap-3">
        {balance !== null && (
          <div className="flex items-center gap-1.5 bg-accent-gold/10 border border-accent-gold/30 rounded-full px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-bold text-accent-gold">{balance.toLocaleString()}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent-green/20 border border-accent-green/30 flex items-center justify-center text-sm font-bold text-accent-green">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <button onClick={logout} className="text-xs text-txt-secondary hover:text-critical transition-colors">
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
