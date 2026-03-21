import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
} from 'chart.js'
import toast from 'react-hot-toast'
import { useAuth } from '../../auth/AuthContext'
import { recyclingService, vehicleService } from '../../services/dataService'
import { realtimeService } from '../../services/realtimeService'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

function CapacityGauge({ pct }) {
  const radius       = 70
  const circumference = 2 * Math.PI * radius
  const offset       = circumference - (pct / 100) * circumference
  const color        = pct >= 90 ? '#ef4444' : pct >= 60 ? '#f97316' : '#10b981'
  return (
    <div className="flex flex-col items-center">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#1a3a5c" strokeWidth="14" />
        <circle
          cx="90" cy="90" r={radius}
          fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 90 90)"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
        />
        <text x="90" y="85" textAnchor="middle" fill={color} fontSize="28" fontWeight="900" fontFamily="Inter">
          {pct.toFixed(0)}%
        </text>
        <text x="90" y="105" textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="Inter">
          CAPACITY
        </text>
      </svg>
      <div className="text-xs text-txt-secondary mt-1">
        {pct >= 90 ? '🔴 Near Full' : pct >= 60 ? '🟠 Moderate' : '🟢 Available'}
      </div>
    </div>
  )
}

const STATUS_BADGE = {
  received:   'badge-blue',
  sorting:    'badge-gold',
  processing: 'badge-orange',
  completed:  'badge-green',
  rejected:   'badge-red',
  pending:    'badge-gray',
}

export default function RecyclingDashboard() {
  const { token } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [capacity,  setCapacity]  = useState([])
  const [intake,    setIntake]    = useState([])
  const [vehicles,  setVehicles]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [wsStatus,  setWsStatus]  = useState('connecting')

  // ── Initial load ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const [d, cap, i, v] = await Promise.all([
      recyclingService.getDashboard(),
      recyclingService.getCapacity(),
      recyclingService.getIntake(),
      vehicleService.getAll(),
    ])
    if (d.error) toast.error('Failed to load dashboard')
    if (d.data)   setDashboard(d.data)
    if (cap.data) setCapacity(cap.data?.plants || [])
    if (i.data)   setIntake((i.data?.intake || []).slice(0, 10))
    if (v.data) {
      const list = Array.isArray(v.data) ? v.data : (v.data?.vehicles || [])
      setVehicles(list.filter((x) => x.status === 'collecting'))
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  // ── Supabase Realtime: recycling_intake table ──────────────────────────────
  useEffect(() => {
    const unsub = realtimeService.onIntakeChange((payload) => {
      if (payload.eventType === 'INSERT') {
        setIntake((prev) => [payload.new, ...prev].slice(0, 10))
        toast.success(`📦 New intake: ${payload.new?.waste_type} — ${payload.new?.gross_weight_kg ?? payload.new?.weight_kg ?? '?'} kg`)
      } else if (payload.eventType === 'UPDATE') {
        setIntake((prev) =>
          prev.map((r) => r.intake_id === payload.new.intake_id ? { ...r, ...payload.new } : r)
        )
      }
    })
    return unsub
  }, [])

  // ── FastAPI WebSocket: recycling_update push ───────────────────────────────
  useEffect(() => {
    if (!token) return
    realtimeService.connectWS(token, (msg) => {
      if (msg.type === 'connected') {
        setWsStatus('live')
      } else if (msg.type === 'recycling_update') {
        const d = msg.data
        if (d.vehicles?.length) setVehicles(d.vehicles)
        if (d.plants_near_capacity > 0) {
          toast.error(`⚠️ ${d.plants_near_capacity} plant(s) near capacity`)
        }
      }
    })
    setWsStatus('connecting')
    const ping = setInterval(() => realtimeService.sendWS({ type: 'ping' }), 30000)
    return () => {
      clearInterval(ping)
      realtimeService.disconnectWS()
      setWsStatus('offline')
    }
  }, [token])

  // ── Chart data ─────────────────────────────────────────────────────────────
  const myPlant    = capacity[0]
  const capacityPct = myPlant
    ? Math.min(100, ((myPlant.current_load_kg || 0) / (myPlant.capacity_kg_per_day || 1)) * 100)
    : (dashboard?.capacity_pct || 0)

  const donutData = {
    labels: Object.keys(dashboard?.by_waste_type_kg || {}),
    datasets: [{
      data: Object.values(dashboard?.by_waste_type_kg || {}),
      backgroundColor: ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6'],
      borderWidth: 0,
    }],
  }

  const statusData = {
    labels: Object.keys(dashboard?.by_processing_status || {}),
    datasets: [{
      label: 'Records',
      data: Object.values(dashboard?.by_processing_status || {}),
      backgroundColor: ['#0ea5e9','#f59e0b','#f97316','#10b981','#ef4444'],
      borderRadius: 4,
    }],
  }

  if (loading) return <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">
            {dashboard?.plant?.plant_name || dashboard?.plant_name || 'RECYCLING CENTER'}
          </h1>
          <p className="text-xs text-txt-secondary mt-1">
            {dashboard?.plant?.address || 'Processing facility'} · Last 7 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`pulse-dot pulse-dot-${wsStatus === 'live' ? 'green' : 'blue'}`}>
            <div className={`w-2 h-2 rounded-full ${wsStatus === 'live' ? 'bg-accent-green' : 'bg-accent-blue'}`} />
          </div>
          <span className={`text-xs font-semibold ${wsStatus === 'live' ? 'text-accent-green' : 'text-accent-blue'}`}>
            {wsStatus === 'live' ? 'OPERATIONAL · WS LIVE' : 'OPERATIONAL'}
          </span>
        </div>
      </div>

      {/* Capacity gauge + stat cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="card card-accent-gold flex flex-col items-center justify-center py-4">
          <CapacityGauge pct={capacityPct} />
          {myPlant && (
            <div className="text-center mt-2">
              <div className="text-xs text-txt-secondary">
                {(myPlant.current_load_kg || 0).toFixed(0)} kg / {(myPlant.capacity_kg_per_day || 0).toFixed(0)} kg/day
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Intake (7d)',  value: dashboard?.total_intake_records || 0,                 color: 'text-accent-blue',  accent: '#0ea5e9' },
            { label: 'Weight Processed',   value: `${(dashboard?.total_weight_kg || 0).toFixed(0)} kg`, color: 'text-accent-green', accent: '#10b981' },
            { label: 'Incoming Vehicles',  value: vehicles.length,                                       color: 'text-accent-gold',  accent: '#f59e0b' },
            { label: 'Plants Online',      value: capacity.filter((p) => p.status === 'operational').length || capacity.length, color: 'text-accent-green', accent: '#10b981' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="stat-card"
              style={{ borderTop: `2px solid ${s.accent}` }}
            >
              <div className={`stat-value ${s.color}`}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Incoming vehicles + charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Incoming vehicles */}
        <div className="card card-accent-gold">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-3">
            INCOMING VEHICLES ({vehicles.length})
          </h3>
          {vehicles.length === 0 ? (
            <p className="text-txt-secondary text-xs text-center py-6">No vehicles currently en route</p>
          ) : (
            <div className="space-y-2">
              {vehicles.map((v, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border-dim bg-bg-secondary">
                  <div>
                    <div className="text-xs font-bold text-txt-primary">{v.vehicle_id}</div>
                    <div className="text-[10px] text-txt-secondary">{v.driver_name || 'Driver'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-accent-gold">
                      {(v.current_load_kg || 0).toFixed(0)} kg
                    </div>
                    <span className="badge badge-green">collecting</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waste type donut */}
        <div className="card card-accent-blue">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-3">WASTE BY TYPE (kg)</h3>
          <div style={{ height: 200 }}>
            {Object.keys(dashboard?.by_waste_type_kg || {}).length > 0
              ? <Doughnut data={donutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, padding: 6 } } }, cutout: '60%' }} />
              : <div className="flex items-center justify-center h-full text-txt-secondary text-xs">No data yet</div>
            }
          </div>
        </div>

        {/* Processing status bar */}
        <div className="card card-accent-green">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-3">PROCESSING STATUS</h3>
          <div style={{ height: 200 }}>
            {Object.keys(dashboard?.by_processing_status || {}).length > 0
              ? <Bar data={statusData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(26,58,92,0.4)' } }, y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(26,58,92,0.4)' } } } }} />
              : <div className="flex items-center justify-center h-full text-txt-secondary text-xs">No data yet</div>
            }
          </div>
        </div>
      </div>

      {/* Intake table — rows flash in via Realtime */}
      <div className="card card-accent-gold">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary">RECENT INTAKE RECORDS</h3>
          <span className="badge badge-gold">{intake.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Intake ID</th>
                <th>Vehicle</th>
                <th>Waste Type</th>
                <th>Gross Weight</th>
                <th>Net Weight</th>
                <th>Grade</th>
                <th>Status</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {intake.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-txt-secondary py-6">No intake records</td></tr>
              ) : intake.map((r, i) => (
                <tr key={r.intake_id || i}>
                  <td className="mono">{r.intake_id}</td>
                  <td className="mono">{r.vehicle_id || '—'}</td>
                  <td><span className="badge badge-blue">{r.waste_type}</span></td>
                  <td>{(r.gross_weight_kg ?? r.weight_kg)?.toFixed(1)} kg</td>
                  <td>{r.net_weight_kg?.toFixed(1) || '—'} kg</td>
                  <td>
                    {r.quality_grade
                      ? <span className={`badge ${r.quality_grade === 'A' ? 'badge-green' : r.quality_grade === 'rejected' ? 'badge-red' : 'badge-gold'}`}>{r.quality_grade}</span>
                      : '—'
                    }
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.processing_status] || 'badge-gray'}`}>
                      {r.processing_status}
                    </span>
                  </td>
                  <td className="text-txt-secondary text-xs">
                    {r.received_at ? format(new Date(r.received_at), 'MMM d, HH:mm') : '—'}
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
