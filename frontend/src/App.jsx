import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { dashboardAPI } from './services/api'
import { useState, useEffect } from 'react'

import Login    from './auth/Login'
import Register from './auth/Register'

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

import CitizenLayout  from './portals/citizen/CitizenLayout'
import CitizenHome    from './portals/citizen/Home'
import NearbyBins     from './portals/citizen/NearbyBins'
import MyTokens       from './portals/citizen/MyTokens'
import ReportWaste    from './portals/citizen/ReportWaste'
import Leaderboard    from './portals/citizen/Leaderboard'

import RecyclingLayout    from './portals/recycling/RecyclingLayout'
import RecyclingDashboard from './portals/recycling/Dashboard'
import IncomingWaste      from './portals/recycling/IncomingWaste'
import Processing         from './portals/recycling/Processing'
import BlockchainLog      from './portals/recycling/BlockchainLog'

// ── SVG icon helpers ──────────────────────────────────────────────────────────
const BuildingIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)
const UserIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)
const RecycleIcon = ({ className = 'w-8 h-8' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)
const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)
const TruckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h10l2-2zM13 6l3 4h3l1 3v3h-2" />
  </svg>
)
const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)
const CogIcon = () => (
  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const PORTALS = [
  {
    Icon: BuildingIcon,
    title: 'Municipality',
    desc: 'Command center for city waste operations. Monitor bins, dispatch vehicles, manage compliance and AI-optimized routes.',
    accent: '#0ea5e9',
    bg: 'rgba(14,165,233,0.06)',
    border: 'rgba(14,165,233,0.25)',
  },
  {
    Icon: UserIcon,
    title: 'Citizen Portal',
    desc: 'Track your recycling impact, earn tokens, find nearby bins, and report waste issues in your neighbourhood.',
    accent: '#10b981',
    bg: 'rgba(16,185,129,0.06)',
    border: 'rgba(16,185,129,0.25)',
  },
  {
    Icon: RecycleIcon,
    title: 'Recycling Plant',
    desc: 'Manage incoming waste intake, track processing status, monitor capacity, and verify blockchain audit trails.',
    accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.25)',
  },
]

const STAT_ICONS = [TrashIcon, TruckIcon, CheckIcon, UsersIcon]

function LandingPage() {
  const [publicStats, setPublicStats] = useState(null)

  useEffect(() => {
    dashboardAPI.getPublic()
      .then((r) => setPublicStats(r.data))
      .catch(() => {})
  }, [])

  const stats = publicStats
    ? [
        { label: 'Bins Monitored',    value: publicStats.city_stats?.total_smart_bins,        Icon: TrashIcon },
        { label: 'Waste Collected',   value: publicStats.city_stats?.total_waste_collected_kg ? `${Math.round(publicStats.city_stats.total_waste_collected_kg / 1000)}t` : '—', Icon: TruckIcon },
        { label: 'Avg Fill Level',    value: `${publicStats.city_stats?.avg_fill_level_pct}%`, Icon: ChartIcon },
        { label: 'Critical Bins',     value: publicStats.city_stats?.bins_needing_collection,  Icon: UsersIcon },
      ]
    : [
        { label: 'Bins Monitored',    value: '20',    Icon: TrashIcon },
        { label: 'Collections Today', value: '28',    Icon: TruckIcon },
        { label: 'Compliance Rate',   value: '94.5%', Icon: CheckIcon },
        { label: 'Citizens Active',   value: '342',   Icon: UsersIcon },
      ]

  return (
    <div className="min-h-screen grid-bg corner-glow">
      {/* Hero */}
      <div className="flex flex-col items-center justify-center pt-20 pb-12 px-4 text-center">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-accent-blue/10 border border-accent-blue/30 mb-6 text-accent-blue">
            <RecycleIcon className="w-10 h-10" />
          </div>
          <h1 className="text-5xl font-black tracking-[0.2em] text-txt-primary mb-3 glow-blue">SMART-WASTE</h1>
          <p className="text-accent-blue text-sm font-semibold tracking-[0.3em] mb-4">MUNICIPAL MANAGEMENT SYSTEM</p>
          <p className="text-txt-secondary text-lg max-w-xl mx-auto leading-relaxed">Intelligent Urban Waste Management for Smart Cities</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-4 mt-10"
        >
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-3 bg-bg-card border border-border-dim rounded-xl px-5 py-3">
              <span className="text-accent-blue"><s.Icon /></span>
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
        <p className="text-center text-xs font-bold tracking-[0.2em] text-txt-secondary mb-8">SELECT YOUR PORTAL</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PORTALS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
              className="rounded-2xl p-6 flex flex-col"
              style={{ background: p.bg, border: `1px solid ${p.border}`, boxShadow: `0 0 30px ${p.accent}10` }}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${p.accent}15`, border: `1px solid ${p.accent}30`, color: p.accent }}
              >
                <p.Icon />
              </div>
              <h3 className="text-base font-black text-txt-primary mb-2">{p.title}</h3>
              <p className="text-xs text-txt-secondary leading-relaxed flex-1 mb-5">{p.desc}</p>
              <Link
                to="/login"
                className="btn text-xs py-2.5 font-bold tracking-wider"
                style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.accent}cc)`, color: p.accent === '#f59e0b' ? '#000' : '#fff', boxShadow: `0 4px 15px ${p.accent}30` }}
              >
                ACCESS PORTAL →
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-16 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="pulse-dot pulse-dot-green"><div className="w-2 h-2 rounded-full bg-accent-green" /></div>
            <span className="text-xs text-accent-green font-semibold">ALL SYSTEMS OPERATIONAL</span>
          </div>
          <p className="text-[10px] text-txt-secondary tracking-widest">SMART-WASTE v1.0 · Powered by AI Agents + Blockchain</p>
        </div>
      </div>
    </div>
  )
}

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

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/"         element={<RootRedirect />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

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

        <Route path="/citizen" element={<CitizenLayout />}>
          <Route index              element={<Navigate to="home" replace />} />
          <Route path="home"        element={<CitizenHome />} />
          <Route path="map"         element={<NearbyBins />} />
          <Route path="tokens"      element={<MyTokens />} />
          <Route path="report"      element={<ReportWaste />} />
          <Route path="leaderboard" element={<Leaderboard />} />
        </Route>

        <Route path="/recycling" element={<RecyclingLayout />}>
          <Route index              element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"   element={<RecyclingDashboard />} />
          <Route path="intake"      element={<IncomingWaste />} />
          <Route path="processing"  element={<Processing />} />
          <Route path="blockchain"  element={<BlockchainLog />} />
          <Route path="reports"     element={<RecyclingReportsPlaceholder />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}

function SettingsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-3">
      <CogIcon />
      <h2 className="text-lg font-black tracking-widest text-txt-primary">SETTINGS</h2>
      <p className="text-txt-secondary text-sm">System configuration coming soon.</p>
    </div>
  )
}

function RecyclingReportsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-3">
      <ChartIcon />
      <h2 className="text-lg font-black tracking-widest text-txt-primary">REPORTS</h2>
      <p className="text-txt-secondary text-sm">Processing reports available in the dashboard.</p>
    </div>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center space-y-4">
      <div className="text-6xl font-black text-txt-primary">404</div>
      <h1 className="text-2xl font-black tracking-widest text-txt-primary">PAGE NOT FOUND</h1>
      <p className="text-txt-secondary">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn btn-primary mt-4">← Return Home</Link>
    </div>
  )
}
