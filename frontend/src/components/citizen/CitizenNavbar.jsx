import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useState, useEffect } from 'react'
import { citizensAPI } from '../../services/api'

const NAV = [
  { to: '/citizen/home',        icon: '🏠', label: 'Home'       },
  { to: '/citizen/map',         icon: '🗺️',  label: 'Map'        },
  { to: '/citizen/tokens',      icon: '🪙', label: 'Tokens'     },
  { to: '/citizen/report',      icon: '📋', label: 'Report'     },
  { to: '/citizen/leaderboard', icon: '🏆', label: 'Leaderboard' },
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
        <span className="text-xl">♻️</span>
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
            <span className="text-sm">🪙</span>
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
