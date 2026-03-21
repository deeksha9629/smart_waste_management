import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const NAV = [
  { to: '/recycling/dashboard',  icon: '♻️', label: 'Dashboard'      },
  { to: '/recycling/intake',     icon: '📥', label: 'Incoming Waste'  },
  { to: '/recycling/processing', icon: '⚙️',  label: 'Processing'     },
  { to: '/recycling/blockchain', icon: '⛓️',  label: 'Blockchain Log' },
  { to: '/recycling/reports',    icon: '📊', label: 'Reports'         },
]

export default function RecyclingNavbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="sidebar" style={{ borderRight: '1px solid rgba(245,158,11,0.2)' }}>
      {/* Logo */}
      <div className="p-5 border-b border-border-dim">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-accent-gold/10 border border-accent-gold/30 flex items-center justify-center text-lg">
            ♻️
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
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`.replace(
                'active',
                isActive ? 'active' : ''
              )
            }
            style={({ isActive }) => isActive ? { color: '#f59e0b', borderLeft: '2px solid #f59e0b', marginLeft: '6px' } : {}}
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
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
