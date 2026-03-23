import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, Title,
} from 'chart.js'
import toast from 'react-hot-toast'
import { useAuth } from '../../auth/AuthContext'
import { municipalityService, collectionService, blockchainService } from '../../services/dataService'
import { realtimeService } from '../../services/realtimeService'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title)

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(26,58,92,0.4)' } },
    y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(26,58,92,0.4)' } },
  },
}

function StatCard({ icon, label, value, sub, accent, delay = 0 }) {
  const colors = {
    blue:   { bg: 'rgba(14,165,233,0.1)',  border: '#0ea5e9', text: '#38bdf8' },
    green:  { bg: 'rgba(16,185,129,0.1)',  border: '#10b981', text: '#34d399' },
    gold:   { bg: 'rgba(245,158,11,0.1)',  border: '#f59e0b', text: '#fbbf24' },
    red:    { bg: 'rgba(239,68,68,0.1)',   border: '#ef4444', text: '#f87171' },
    orange: { bg: 'rgba(249,115,22,0.1)',  border: '#f97316', text: '#fb923c' },
    purple: { bg: 'rgba(139,92,246,0.1)',  border: '#8b5cf6', text: '#a78bfa' },
  }
  const c = colors[accent] || colors.blue
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="stat-card"
      style={{ borderTop: `2px solid ${c.border}` }}
    >
      <div className="stat-icon" style={{ background: c.bg }}>
        <span className="flex items-center justify-center" style={{ color: c.text }}>{icon}</span>
      </div>
      <div className="stat-value" style={{ color: c.text }}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="text-[10px] text-txt-secondary mt-1">{sub}</div>}
    </motion.div>
  )
}

function AgentStatus({ name, interval, color }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-dim/40 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`pulse-dot pulse-dot-${color}`}>
          <div className={`w-2 h-2 rounded-full bg-accent-${color === 'green' ? 'green' : color === 'blue' ? 'blue' : 'gold'}`} />
        </div>
        <span className="text-xs text-txt-primary">{name}</span>
      </div>
      <span className="text-[10px] text-txt-secondary font-mono">{interval}</span>
    </div>
  )
}

export default function MunicipalityDashboard() {
  const { token } = useAuth()
  const [stats,       setStats]       = useState(null)
  const [alerts,      setAlerts]      = useState([])
  const [collections, setCollections] = useState([])
  const [chainStats,  setChainStats]  = useState(null)
  const [now,         setNow]         = useState(new Date())
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState(false)
  const [wsStatus,    setWsStatus]    = useState('connecting') // connecting | live | offline

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    const [s, a, c, bc] = await Promise.all([
      municipalityService.getDashboard(),
      municipalityService.getAlerts(),
      collectionService.getToday(),
      blockchainService.getStats(),
    ])
    const anyError = s.error && a.error && c.error && bc.error
    setLoadError(anyError)
    if (s.data)  setStats(s.data)
    if (a.data)  setAlerts((a.data.alerts || []).slice(0, 5))
    if (c.data)  setCollections((c.data.events || []).slice(0, 10))
    if (bc.data) setChainStats(bc.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30 s
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  // ── Supabase Realtime: bins table ──────────────────────────────────────────
  useEffect(() => {
    const unsub = realtimeService.onBinChange((payload) => {
      // A bin row changed — bump critical count if fill_level crossed threshold
      if (payload.new?.fill_level !== undefined) {
        setStats((prev) => {
          if (!prev) return prev
          const fill = payload.new.fill_level
          const wasCritical = (payload.old?.fill_level ?? 0) >= 80
          const isCritical  = fill >= 80
          if (isCritical && !wasCritical) {
            toast.error(`Bin ${payload.new.bin_id} is now critical (${fill}%)`)
            return { ...prev, critical_bins: (prev.critical_bins || 0) + 1 }
          }
          if (!isCritical && wasCritical) {
            return { ...prev, critical_bins: Math.max(0, (prev.critical_bins || 1) - 1) }
          }
          return prev
        })
      }
    })

    // Supabase Realtime: alerts table
    const unsubAlert = realtimeService.onAlertChange((payload) => {
      if (payload.eventType === 'INSERT' && !payload.new?.is_resolved) {
        setAlerts((prev) => [payload.new, ...prev].slice(0, 5))
        toast.error(`New alert: ${payload.new?.title}`)
      }
    })

    // Supabase Realtime: collection_events table
    const unsubCol = realtimeService.onCollectionChange((payload) => {
      if (payload.eventType === 'INSERT') {
        setCollections((prev) => [payload.new, ...prev].slice(0, 10))
        setStats((prev) => prev ? { ...prev, collections_today: (prev.collections_today || 0) + 1 } : prev)
      }
    })

    return () => { unsub(); unsubAlert(); unsubCol() }
  }, [])

  // ── FastAPI WebSocket ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return
    realtimeService.connectWS(token, (msg) => {
      if (msg.type === 'connected') {
        setWsStatus('live')
      } else if (msg.type === 'municipality_update') {
        const d = msg.data
        setStats((prev) => prev ? {
          ...prev,
          critical_bins:      d.critical_bins      ?? prev.critical_bins,
          unresolved_alerts:  d.unresolved_alerts  ?? prev.unresolved_alerts,
          active_vehicles:    d.active_vehicles    ?? prev.active_vehicles,
        } : prev)
        if (d.latest_alerts?.length) {
          setAlerts(d.latest_alerts.slice(0, 5))
        }
      }
    })
    setWsStatus('connecting')

    // Ping every 30 s to keep connection alive
    const pingTimer = setInterval(() => realtimeService.sendWS({ type: 'ping' }), 30000)

    return () => {
      clearInterval(pingTimer)
      realtimeService.disconnectWS()
      setWsStatus('offline')
    }
  }, [token])

  const donutData = {
    labels: ['General', 'Recyclable', 'Organic', 'Hazardous', 'Electronic'],
    datasets: [{
      data: [35, 28, 20, 10, 7],
      backgroundColor: ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6'],
      borderWidth: 0,
    }],
  }

  const barData = {
    labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    datasets: [{
      label: 'Collections',
      data: [42, 38, 55, 47, 61, 29, 18],
      backgroundColor: 'rgba(14,165,233,0.6)',
      borderRadius: 4,
    }],
  }

  const severityColor = { critical: 'badge-red', high: 'badge-orange', medium: 'badge-gold', low: 'badge-blue' }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="spinner spinner-lg mx-auto mb-3" />
          <p className="text-txt-secondary text-xs tracking-widest">LOADING DASHBOARD...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {loadError && (
        <div className="card border border-red-500/40 bg-red-500/10 text-red-400 text-xs px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          Backend unreachable — showing cached / mock data. Start the FastAPI server and refresh.
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">
            MUNICIPAL WASTE CONTROL CENTER
          </h1>
          <p className="text-xs text-txt-secondary mt-1 font-mono">
            {format(now, 'EEEE, MMMM d yyyy')} — {format(now, 'HH:mm:ss')}
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { label: 'IoT Sensors',  color: 'green' },
            { label: 'AI Agents',    color: 'blue'  },
            { label: 'Blockchain',   color: 'gold'  },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 bg-bg-card border border-border-dim rounded-full px-3 py-1.5">
              <div className={`pulse-dot pulse-dot-${s.color}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${s.color === 'green' ? 'bg-accent-green' : s.color === 'blue' ? 'bg-accent-blue' : 'bg-accent-gold'}`} />
              </div>
              <span className="text-[10px] font-semibold text-txt-secondary">{s.label}</span>
            </div>
          ))}
          {/* WebSocket live indicator */}
          <div className="flex items-center gap-1.5 bg-bg-card border border-border-dim rounded-full px-3 py-1.5">
            <div className={`pulse-dot pulse-dot-${wsStatus === 'live' ? 'green' : wsStatus === 'connecting' ? 'blue' : 'orange'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'live' ? 'bg-accent-green' : wsStatus === 'connecting' ? 'bg-accent-blue' : 'bg-warning'}`} />
            </div>
            <span className="text-[10px] font-semibold text-txt-secondary uppercase">
              {wsStatus === 'live' ? 'WS LIVE' : wsStatus === 'connecting' ? 'WS CONN...' : 'WS OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>} label="TOTAL BINS" value={stats?.total_bins} accent="blue" delay={0} />
        <StatCard icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>} label="CRITICAL BINS" value={stats?.critical_bins} accent="red" delay={0.05} sub="≥80% full" />
        <StatCard icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h10l2-2zM13 6l3 4h3l1 3v3h-2" /></svg>} label="ACTIVE VEHICLES" value={`${stats?.active_vehicles||0}/${stats?.total_vehicles||0}`} accent="green" delay={0.1} />
        <StatCard icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>} label="COLLECTIONS TODAY" value={stats?.collections_today} accent="gold" delay={0.15} />
        <StatCard icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} label="OPEN ALERTS" value={stats?.unresolved_alerts} accent="orange" delay={0.2} />
        <StatCard icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>} label="CITIZEN REPORTS" value={stats?.citizen_reports_today ?? 0} accent="purple" delay={0.25} sub={`${stats?.pending_reports ?? 0} pending`} />
      </div>

      {/* Row 2: Map + Alerts + Blockchain */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Map placeholder */}
        <div className="xl:col-span-2 card card-accent-blue" style={{ minHeight: 320 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold tracking-widest text-txt-secondary">LIVE BIN MAP</h3>
            <span className="badge badge-green">● LIVE</span>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ height: 260, background: '#0a1628', border: '1px solid #1a3a5c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-center">
              <div className="mb-2 text-txt-secondary"><svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg></div>
              <p className="text-txt-secondary text-xs">Navigate to <strong className="text-accent-blue">Live Map</strong> for full view</p>
              <p className="text-txt-secondary text-[10px] mt-1">{stats?.total_bins || 0} bins monitored</p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="card card-accent-red">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold tracking-widest text-txt-secondary">CRITICAL ALERTS</h3>
            <span className="badge badge-red">{alerts.length}</span>
          </div>
          <div className="space-y-2">
            {alerts.length === 0 ? (
              <p className="text-txt-secondary text-xs text-center py-4">No unresolved alerts</p>
            ) : alerts.map((a, i) => (
              <div key={i} className={`alert-item ${a.severity}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-txt-primary truncate">{a.title}</div>
                  <div className="text-[10px] text-txt-secondary mt-0.5 truncate">{a.message}</div>
                </div>
                <span className={`badge ${severityColor[a.severity] || 'badge-gray'} shrink-0`}>{a.severity}</span>
              </div>
            ))}
          </div>

          {/* Agent status */}
          <div className="mt-4 pt-3 border-t border-border-dim">
            <p className="section-title mb-2">AGENT STATUS</p>
            <AgentStatus name="IoT Simulator"    interval="5 min"  color="green" />
            <AgentStatus name="Prediction Agent" interval="15 min" color="blue"  />
            <AgentStatus name="Route Agent"      interval="30 min" color="green" />
            <AgentStatus name="Compliance Agent" interval="60 min" color="green" />
            <AgentStatus name="Blockchain Agent" interval="10 min" color="blue"  />
          </div>
        </div>

        {/* Waste distribution */}
        <div className="card card-accent-purple">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-3">WASTE DISTRIBUTION</h3>
          <div style={{ height: 160 }}>
            <Doughnut
              data={donutData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, padding: 8 } },
                },
                cutout: '65%',
              }}
            />
          </div>
          {/* Blockchain mini stats */}
          <div className="mt-4 pt-3 border-t border-border-dim space-y-2">
            <p className="section-title">BLOCKCHAIN STATS</p>
            {chainStats && Object.entries(chainStats.by_type || {}).slice(0, 3).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-txt-secondary capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="font-mono text-accent-blue">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card card-accent-blue">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">WEEKLY COLLECTIONS</h3>
          <div style={{ height: 200 }}>
            <Bar data={barData} options={CHART_OPTS} />
          </div>
        </div>
        <div className="card card-accent-green">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-3">COMPLIANCE OVERVIEW</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Compliance Rate', value: `${stats?.avg_compliance_score || 94}%`, color: 'text-accent-green' },
              { label: 'Violations Today', value: stats?.violations_today || 0, color: 'text-critical' },
              { label: 'Avg Fill Level', value: `${stats?.avg_fill_level || 0}%`, color: 'text-accent-gold' },
              { label: 'Plants Online', value: `${stats?.operational_plants || 0}/${stats?.total_plants || 0}`, color: 'text-accent-blue' },
            ].map((m) => (
              <div key={m.label} className="bg-bg-secondary rounded-lg p-3 border border-border-dim">
                <div className={`text-xl font-black ${m.color}`}>{m.value}</div>
                <div className="text-[10px] text-txt-secondary mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Recent collections table */}
      <div className="card card-accent-gold">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary">RECENT COLLECTION EVENTS</h3>
          <span className="badge badge-blue">{collections.length} today</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Bin</th>
                <th>Vehicle</th>
                <th>Waste Type</th>
                <th>Fill Before</th>
                <th>Compliance</th>
                <th>Blockchain Hash</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {collections.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-txt-secondary py-6">No collections today</td></tr>
              ) : collections.map((c, i) => (
                <tr key={i}>
                  <td className="mono">{c.event_id}</td>
                  <td className="mono">{c.bin_id}</td>
                  <td className="mono">{c.vehicle_id}</td>
                  <td><span className="badge badge-blue">{c.waste_type || '—'}</span></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="fill-bar w-16" style={{ height: 4 }}>
                        <div className="fill-bar-inner" style={{ width: `${c.fill_before || 0}%`, background: (c.fill_before || 0) >= 80 ? '#ef4444' : '#0ea5e9' }} />
                      </div>
                      <span className="text-xs">{c.fill_before || 0}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${c.compliance_score >= 70 ? 'badge-green' : 'badge-red'}`}>
                      {c.compliance_score || 100}
                    </span>
                  </td>
                  <td>
                    <span className="hash-text truncate-hash block">{c.blockchain_hash || '—'}</span>
                  </td>
                  <td className="text-txt-secondary text-xs">
                    {c.collected_at ? format(new Date(c.collected_at), 'HH:mm') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
