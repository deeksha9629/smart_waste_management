import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const Icon = ({ d, d2 }) => (
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    {d2 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d2} />}
  </svg>
)

const NAV = [
  { to: '/recycling/dashboard',  icon: <Icon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />, label: 'Dashboard' },
  { to: '/recycling/intake',     icon: <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />,                                                                                    label: 'Incoming Waste' },
  { to: '/recycling/processing', icon: <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" d2="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />, label: 'Processing' },
  { to: '/recycling/blockchain', icon: <Icon d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,             label: 'Blockchain Log' },
  { to: '/recycling/reports',    icon: <Icon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />, label: 'Reports' },
]

export default function RecyclingNavbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="sidebar" style={{ borderRight: '1px solid rgba(245,158,11,0.2)' }}>
      {/* Logo */}
      <div className="p-5 border-b border-border-dim">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-accent-gold/10 border border-accent-gold/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-black tracking-[0.15em] text-txt-primary">SMART WASTE</div>
            <div className="text-[9px] font-semibold tracking-[0.15em] text-accent-gold">RECYCLING CENTER</div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-accent-gold/5 border border-accent-gold/20 rounded-lg px-3 py-2">
          <div className="pulse-dot pulse-dot-green">
            <div className="w-2 h-2 rounded-full bg-accent-green" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-accent-gold tracking-wider">PLANT ONLINE</div>
            <div className="text-[9px] text-txt-secondary">Processing active</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 py-3">
        <div className="sidebar-section-label">PLANT OPERATIONS</div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            style={({ isActive }) => isActive ? { color: '#f59e0b', borderLeft: '2px solid #f59e0b', marginLeft: '6px' } : {}}
          >
            <span className="w-5 flex items-center justify-center">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* User footer */}
      <div className="p-4 border-t border-border-dim">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent-gold/20 border border-accent-gold/30 flex items-center justify-center text-sm font-bold text-accent-gold">
            {user?.full_name?.[0]?.toUpperCase() || 'R'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-txt-primary truncate">{user?.full_name || 'Manager'}</div>
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
