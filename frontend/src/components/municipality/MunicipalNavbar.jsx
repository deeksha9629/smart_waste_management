import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const Icon = ({ d, d2 }) => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    {d2 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d2} />}
  </svg>
)

const ICONS = {
  dashboard: <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  map:       <Icon d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />,
  truck:     <Icon d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" d2="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h10l2-2zM13 6l3 4h3l1 3v3h-2" />,
  sparkles:  <Icon d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
  chain:     <Icon d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
  bell:      <Icon d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
  clipboard: <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />,
  chart:     <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  cog:       <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" d2="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
  recycle:   <Icon d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />,
}

const NAV = {
  MAIN: [
    { to: '/municipality/dashboard',   icon: ICONS.dashboard, label: 'Dashboard' },
    { to: '/municipality/map',         icon: ICONS.map,       label: 'Live Map',         badge: 'LIVE', badgeColor: 'badge-green' },
    { to: '/municipality/routes',      icon: ICONS.truck,     label: 'Route Optimizer' },
    { to: '/municipality/predictions', icon: ICONS.sparkles,  label: 'AI Predictions' },
    { to: '/municipality/blockchain',  icon: ICONS.chain,     label: 'Blockchain Ledger' },
  ],
  MANAGEMENT: [
    { to: '/municipality/alerts',      icon: ICONS.bell,      label: 'Alerts' },
    { to: '/municipality/reports',     icon: ICONS.clipboard, label: 'Reports' },
    { to: '/municipality/fleet',       icon: ICONS.truck,     label: 'Fleet Management' },
    { to: '/municipality/analytics',   icon: ICONS.chart,     label: 'Analytics' },
  ],
  SYSTEM: [
    { to: '/municipality/settings',    icon: ICONS.cog,       label: 'Settings' },
  ],
}

export default function MunicipalNavbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="p-5 border-b border-border-dim">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-accent-green/10 border border-accent-green/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
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
            <span className="w-5 flex items-center justify-center">{item.icon}</span>
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
            <span className="w-5 flex items-center justify-center">{item.icon}</span>
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
            <span className="w-5 flex items-center justify-center">{item.icon}</span>
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
