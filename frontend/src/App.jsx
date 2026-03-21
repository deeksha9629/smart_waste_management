import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { dashboardAPI } from './services/api'
import { useState, useEffect } from 'react'

// ── Auth pages ────────────────────────────────────────────────────────────────
import Login    from './auth/Login'
import Register from './auth/Register'

// ── Municipality portal ───────────────────────────────────────────────────────
import MunicipalityLayout from './portals/municipality/MunicipalityLayout'
import MunicipalDashboard from './portals/municipality/Dashboard'
import MapView            from './portals/municipality/MapView'
import Routes_            from './portals/municipality/Routes'
import Predictions        from './portals/municipality/Predictions'
import Blockchain         from './portals/municipality/Blockchain'
import Analytics          from './portals/municipality/Analytics'
import Alerts             from './portals/municipality/Alerts'
import MunicipalReports   from './portals/municipality/Reports'
import FleetManagement    from './portals/municipality/Fleet'

// ── Citizen portal ────────────────────────────────────────────────────────────
import CitizenLayout  from './portals/citizen/CitizenLayout'
import CitizenHome    from './portals/citizen/Home'
import NearbyBins     from './portals/citizen/NearbyBins'
import MyTokens       from './portals/citizen/MyTokens'
import ReportWaste    from './portals/citizen/ReportWaste'
import Leaderboard    from './portals/citizen/Leaderboard'

// ── Recycling portal ──────────────────────────────────────────────────────────
import RecyclingLayout   from './portals/recycling/RecyclingLayout'
import RecyclingDashboard from './portals/recycling/Dashboard'
import IncomingWaste     from './portals/recycling/IncomingWaste'
import Processing        from './portals/recycling/Processing'
import BlockchainLog     from './portals/recycling/BlockchainLog'

// ── Landing page ──────────────────────────────────────────────────────────────
const PORTALS = [
  {
    icon: '🏛️',
    title: 'Municipality',
    desc: 'Command center for city waste operations. Monitor bins, dispatch vehicles, manage compliance and AI-optimized routes.',
    accent: '#0ea5e9',
    bg: 'rgba(14,165,233,0.06)',
    border: 'rgba(14,165,233,0.25)',
  },
  {
    icon: '👤',
    title: 'Citizen Portal',
    desc: 'Track your recycling impact, earn tokens, find nearby bins, and report waste issues in your neighbourhood.',
    accent: '#10b981',
    bg: 'rgba(16,185,129,0.06)',
    border: 'rgba(16,185,129,0.25)',
  },
  {
    icon: '♻️',
    title: 'Recycling Plant',
    desc: 'Manage incoming waste intake, track processing status, monitor capacity, and verify blockchain audit trails.',
    accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.25)',
  },
]

const PUBLIC_STATS = [
  { label: 'Bins Monitored',    value: '20',    icon: '🗑️' },
  { label: 'Collections Today', value: '28',    icon: '🚛' },
  { label: 'Compliance Rate',   value: '94.5%', icon: '✅' },
  { label: 'Citizens Active',   value: '342',   icon: '👥' },
]

function LandingPage() {
  const [publicStats, setPublicStats] = useState(null)

  useEffect(() => {
    dashboardAPI.getPublic()
      .then((r) => setPublicStats(r.data))
      .catch(() => {})
  }, [])

  const stats = publicStats
    ? [
        { label: 'Bins Monitored',    value: publicStats.city_stats?.total_smart_bins,        icon: '🗑️' },
        { label: 'Collections Today', value: publicStats.city_stats?.total_waste_collected_kg ? `${Math.round(publicStats.city_stats.total_waste_collected_kg / 1000)}t` : '—', icon: '🚛' },
        { label: 'Avg Fill Level',    value: `${publicStats.city_stats?.avg_fill_level_pct}%`, icon: '📊' },
        { label: 'Critical Bins',     value: publicStats.city_stats?.bins_needing_collection,  icon: '⚠️' },
      ]
    : PUBLIC_STATS

  return (
    <div className="min-h-screen grid-bg corner-glow">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center pt-20 pb-12 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-accent-blue/10 border border-accent-blue/30 mb-6 text-4xl">
            ♻️
          </div>
          <h1 className="text-5xl font-black tracking-[0.2em] text-txt-primary mb-3 glow-blue">
            SMART-WASTE
          </h1>
          <p className="text-accent-blue text-sm font-semibold tracking-[0.3em] mb-4">
            MUNICIPAL MANAGEMENT SYSTEM
          </p>
          <p className="text-txt-secondary text-lg max-w-xl mx-auto leading-relaxed">
            Intelligent Urban Waste Management for Smart Cities
          </p>
        </motion.div>

        {/* Live stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-4 mt-10"
        >
          {stats.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-bg-card border border-border-dim rounded-xl px-5 py-3"
            >
              <span className="text-xl">{s.icon}</span>
              <div className="text-left">
                <div className="text-lg font-black text-txt-primary">{s.value ?? '—'}</div>
                <div className="text-[10px] text-txt-secondary tracking-wider">{s.label}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Portal cards */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <p className="text-center text-xs font-bold tracking-[0.2em] text-txt-secondary mb-8">
          SELECT YOUR PORTAL
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PORTALS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
              className="rounded-2xl p-6 flex flex-col"
              style={{
                background: p.bg,
                border: `1px solid ${p.border}`,
                boxShadow: `0 0 30px ${p.accent}10`,
              }}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl mb-4"
                style={{ background: `${p.accent}15`, border: `1px solid ${p.accent}30` }}
              >
                {p.icon}
              </div>
              <h3 className="text-base font-black text-txt-primary mb-2">{p.title}</h3>
              <p className="text-xs text-txt-secondary leading-relaxed flex-1 mb-5">{p.desc}</p>
              <Link
                to="/login"
                className="btn text-xs py-2.5 font-bold tracking-wider"
                style={{
                  background: `linear-gradient(135deg, ${p.accent}, ${p.accent}cc)`,
                  color: p.accent === '#f59e0b' ? '#000' : '#fff',
                  boxShadow: `0 4px 15px ${p.accent}30`,
                }}
              >
                ACCESS PORTAL →
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-16 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="pulse-dot pulse-dot-green">
              <div className="w-2 h-2 rounded-full bg-accent-green" />
            </div>
            <span className="text-xs text-accent-green font-semibold">ALL SYSTEMS OPERATIONAL</span>
          </div>
          <p className="text-[10px] text-txt-secondary tracking-widest">
            SMART-WASTE v1.0 · Powered by AI Agents + Blockchain
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Root redirect ─────────────────────────────────────────────────────────────
function RootRedirect() {
  const { isAuthenticated, isMunicipality, isCitizen, isRecycling, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-center">
          <div className="spinner spinner-lg mx-auto mb-4" />
          <p className="text-txt-secondary text-xs tracking-widest">INITIALISING SYSTEM...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <LandingPage />
  if (isMunicipality)   return <Navigate to="/municipality/dashboard" replace />
  if (isCitizen)        return <Navigate to="/citizen/home"           replace />
  if (isRecycling)      return <Navigate to="/recycling/dashboard"    replace />
  return <Navigate to="/login" replace />
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/"         element={<RootRedirect />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Municipality portal */}
        <Route path="/municipality" element={<MunicipalityLayout />}>
          <Route index                element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"     element={<MunicipalDashboard />} />
          <Route path="map"           element={<MapView />} />
          <Route path="routes"        element={<Routes_ />} />
          <Route path="predictions"   element={<Predictions />} />
          <Route path="blockchain"    element={<Blockchain />} />
          <Route path="analytics"     element={<Analytics />} />
          <Route path="alerts"        element={<Alerts />} />
          <Route path="reports"       element={<MunicipalReports />} />
          <Route path="fleet"         element={<FleetManagement />} />
          <Route path="settings"      element={<SettingsPlaceholder />} />
        </Route>

        {/* Citizen portal */}
        <Route path="/citizen" element={<CitizenLayout />}>
          <Route index              element={<Navigate to="home" replace />} />
          <Route path="home"        element={<CitizenHome />} />
          <Route path="map"         element={<NearbyBins />} />
          <Route path="tokens"      element={<MyTokens />} />
          <Route path="report"      element={<ReportWaste />} />
          <Route path="leaderboard" element={<Leaderboard />} />
        </Route>

        {/* Recycling portal */}
        <Route path="/recycling" element={<RecyclingLayout />}>
          <Route index              element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"   element={<RecyclingDashboard />} />
          <Route path="intake"      element={<IncomingWaste />} />
          <Route path="processing"  element={<Processing />} />
          <Route path="blockchain"  element={<BlockchainLog />} />
          <Route path="reports"     element={<RecyclingReportsPlaceholder />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}

// ── Placeholder pages ─────────────────────────────────────────────────────────
function SettingsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-3">
      <div className="text-5xl">⚙️</div>
      <h2 className="text-lg font-black tracking-widest text-txt-primary">SETTINGS</h2>
      <p className="text-txt-secondary text-sm">System configuration coming soon.</p>
    </div>
  )
}

function RecyclingReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-3">
      <div className="text-5xl">📊</div>
      <h2 className="text-lg font-black tracking-widest text-txt-primary">REPORTS</h2>
      <p className="text-txt-secondary text-sm">Processing reports available in the dashboard.</p>
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center space-y-4">
      <div className="text-6xl">404</div>
      <h1 className="text-2xl font-black tracking-widest text-txt-primary">PAGE NOT FOUND</h1>
      <p className="text-txt-secondary">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary mt-4">← Return Home</Link>
    </div>
  )
}
