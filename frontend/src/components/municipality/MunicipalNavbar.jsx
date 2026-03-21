import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const NAV = {
  MAIN: [
    { to: '/municipality/dashboard',  icon: '📊', label: 'Dashboard' },
    { to: '/municipality/map',        icon: '🗺️',  label: 'Live Map',        badge: 'LIVE',    badgeColor: 'badge-green' },
    { to: '/municipality/routes',     icon: '🚛', label: 'Route Optimizer' },
    { to: '/municipality/predictions',icon: '🔮', label: 'AI Predictions',   badge: null,      badgeColor: 'badge-red' },
    { to: '/municipality/blockchain', icon: '⛓️',  label: 'Blockchain Ledger' },
  ],
  MANAGEMENT: [
    { to: '/municipality/alerts',     icon: '🚨', label: 'Alerts',           badge: null,      badgeColor: 'badge-red' },
    { to: '/municipality/reports',    icon: '📋', label: 'Reports' },
    { to: '/municipality/fleet',      icon: '🚛', label: 'Fleet Management' },
    { to: '/municipality/analytics',  icon: '📈', label: 'Analytics' },
  ],
  SYSTEM: [
    { to: '/municipality/settings',   icon: '⚙️',  label: 'Settings' },
  ],
}

export default function MunicipalNavbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="p-5 border-b border-border-dim">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-accent-green/10 border border-accent-green/30 flex items-center justify-center text-lg">
            ♻️
          </div>
          <div>
            <div className="text-sm font-black tracking-[0.15em] text-txt-primary">SMART WASTE</div>
            <div className="text-[9px] font-semibold tracking-[0.15em] text-accent-blue">MUNICIPAL CONTROL SYSTEM</div>
          </div>
        </div>

        {/* System status */}
        <div className="flex items-center gap-2 bg-accent-green/5 border border-accent-green/20 rounded-lg px-3 py-2">
          <div className="pulse-dot pulse-dot-green">
            <div className="w-2 h-2 rounded-full bg-accent-green" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-accent-green tracking-wider">SYSTEM ONLINE</div>
            <div className="text-[9px] text-txt-secondary">All 5 agents active</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 py-3 overflow-y-auto">
        <div className="sidebar-section-label">MAIN</div>
        {NAV.MAIN.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className={`badge ${item.badgeColor} text-[9px]`}>{item.badge}</span>
            )}
          </NavLink>
        ))}

        <div className="sidebar-section-label mt-2">MANAGEMENT</div>
        {NAV.MANAGEMENT.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
          </NavLink>
        ))}

        <div className="sidebar-section-label mt-2">SYSTEM</div>
        {NAV.SYSTEM.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* User footer */}
      <div className="p-4 border-t border-border-dim">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center text-sm font-bold text-accent-blue">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-txt-primary truncate">{user?.full_name || 'User'}</div>
            <div className="text-[10px] text-txt-secondary capitalize">{user?.role?.replace(/_/g, ' ')}</div>
          </div>
        </div>
        <button onClick={logout} className="btn btn-ghost w-full text-xs py-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </nav>
  )
}
