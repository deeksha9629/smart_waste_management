import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useAuth } from '../../auth/AuthContext'
import { citizenService, dashboardService, binService } from '../../services/dataService'
import toast from 'react-hot-toast'

const TIPS = [
  { icon: '♻️', title: 'Separate Your Waste', desc: 'Sort recyclables from general waste to earn 5x more tokens.' },
  { icon: '🌱', title: 'Compost Organic Waste', desc: 'Organic waste earns 5 tokens/kg and reduces landfill by 30%.' },
  { icon: '📱', title: 'Report Illegal Dumping', desc: 'Earn 5 bonus tokens for every verified waste report you submit.' },
]

export default function CitizenHome() {
  const { user } = useAuth()
  const [wallet,       setWallet]       = useState(null)
  const [transactions, setTransactions] = useState([])
  const [dashboard,    setDashboard]    = useState(null)
  const [nearbyBins,   setNearbyBins]   = useState([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    Promise.all([
      citizenService.getTokens(),
      citizenService.getHistory(),
      dashboardService.getCitizen(),
    ]).then(([w, h, d]) => {
      if (w.data) setWallet(w.data)
      if (h.data) setTransactions((h.data?.transactions || []).slice(0, 5))
      if (d.data) setDashboard(d.data)
      if (w.error || h.error) toast.error('Failed to load dashboard')
    }).finally(() => setLoading(false))

    // Try to get nearby bins using browser location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords
          binService.getNearby(lat, lng, 1).then(({ data }) => {
            setNearbyBins(Array.isArray(data) ? data : (data?.bins || []))
          })
        },
        () => {}
      )
    }
  }, [])

  const co2Saved = ((wallet?.total_waste_kg || 0) * 0.5).toFixed(1)

  if (loading) return <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card card-accent-green text-center py-8"
      >
        <h1 className="text-lg font-bold text-txt-secondary mb-1">Welcome back,</h1>
        <h2 className="text-3xl font-black text-txt-primary mb-4">{user?.full_name || 'Citizen'} 👋</h2>

        {/* Token balance */}
        <div className="inline-flex flex-col items-center bg-accent-gold/10 border border-accent-gold/30 rounded-2xl px-8 py-4 mb-4">
          <div className="text-5xl mb-1">🪙</div>
          <div className="text-4xl font-black text-accent-gold glow-gold">
            {(wallet?.token_balance || 0).toLocaleString()}
          </div>
          <div className="text-xs text-txt-secondary mt-1 tracking-wider">TOKENS AVAILABLE</div>
        </div>

        <div className="flex justify-center gap-3">
          <Link to="/citizen/tokens" className="btn btn-gold text-sm">
            🎁 Redeem Tokens
          </Link>
          <Link to="/citizen/report" className="btn btn-ghost text-sm">
            📋 Report Waste
          </Link>
        </div>

        {/* Streak */}
        {(wallet?.streak_days || 0) > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-full px-4 py-2">
            <span className="text-lg">🔥</span>
            <span className="text-sm font-bold text-warning">{wallet.streak_days}-day recycling streak!</span>
          </div>
        )}
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: '⚖️', label: 'Total Recycled',  value: `${(wallet?.total_waste_kg || 0).toFixed(1)} kg`, color: 'text-accent-green' },
          { icon: '🌿', label: 'CO₂ Saved',       value: `${co2Saved} kg`,                                 color: 'text-accent-blue'  },
          { icon: '🏆', label: 'Your Rank',        value: dashboard?.leaderboard_rank ? `#${dashboard.leaderboard_rank}` : '—', color: 'text-accent-gold' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card text-center"
          >
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-txt-secondary mt-1">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Nearby bins mini-map */}
      <div className="card card-accent-blue">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary">NEARBY BINS</h3>
          <Link to="/citizen/map" className="text-xs text-accent-blue hover:text-sky-300">View full map →</Link>
        </div>
        <div className="rounded-lg overflow-hidden" style={{ height: 220 }}>
          {nearbyBins.length > 0 ? (
            <MapContainer
              center={[nearbyBins[0].location_lat, nearbyBins[0].location_lng]}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              {nearbyBins.map((bin) => {
                const color = bin.fill_level >= 80 ? '#ef4444' : bin.fill_level >= 50 ? '#f59e0b' : '#10b981'
                return (
                  <CircleMarker
                    key={bin.bin_id}
                    center={[parseFloat(bin.location_lat), parseFloat(bin.location_lng)]}
                    radius={8}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}
                  >
                    <Popup>
                      <div className="text-xs">
                        <strong>{bin.bin_id}</strong><br />
                        Fill: {bin.fill_level}% · {bin.waste_type}<br />
                        {bin.distance_km} km away
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              })}
            </MapContainer>
          ) : (
            <div className="flex items-center justify-center h-full bg-bg-secondary rounded-lg border border-border-dim">
              <div className="text-center">
                <div className="text-3xl mb-2">📍</div>
                <p className="text-txt-secondary text-xs">Enable location to see nearby bins</p>
                <Link to="/citizen/map" className="text-accent-blue text-xs mt-1 block">Open full map</Link>
              </div>
            </div>
          )}
        </div>
        {nearbyBins.length > 0 && (
          <p className="text-xs text-txt-secondary mt-2">{nearbyBins.length} bins within 1 km</p>
        )}
      </div>

      {/* Recent activity */}
      <div className="card card-accent-gold">
        <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-3">RECENT ACTIVITY</h3>
        {transactions.length === 0 ? (
          <p className="text-txt-secondary text-sm text-center py-4">No activity yet. Start recycling to earn tokens!</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border-dim/40 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${tx.action === 'earned' || tx.action === 'bonus' ? 'bg-accent-green/10' : 'bg-critical/10'}`}>
                    {tx.action === 'earned' ? '♻️' : tx.action === 'bonus' ? '⭐' : '🎁'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-txt-primary">{tx.description || tx.action}</div>
                    <div className="text-[10px] text-txt-secondary">
                      {tx.created_at ? format(new Date(tx.created_at), 'MMM d, HH:mm') : '—'}
                      {tx.waste_type && ` · ${tx.waste_type}`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${tx.action === 'redeemed' ? 'text-critical' : 'text-accent-green'}`}>
                    {tx.action === 'redeemed' ? '-' : '+'}{tx.amount} 🪙
                  </div>
                  {tx.blockchain_hash && (
                    <div className="hash-text truncate-hash">{tx.blockchain_hash}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div>
        <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-3">RECYCLING TIPS</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIPS.map((tip, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card card-accent-green"
            >
              <div className="text-2xl mb-2">{tip.icon}</div>
              <div className="text-sm font-bold text-txt-primary mb-1">{tip.title}</div>
              <div className="text-xs text-txt-secondary">{tip.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
