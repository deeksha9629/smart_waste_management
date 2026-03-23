import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { useAuth } from '../../auth/AuthContext'
import { citizenService, dashboardService, binService } from '../../services/dataService'
import toast from 'react-hot-toast'

const RecycleIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)
const StarIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
)
const GiftIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
  </svg>
)
const CoinIcon = () => (
  <svg className="w-10 h-10 text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const SmallCoinIcon = () => (
  <svg className="w-3.5 h-3.5 text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const TIPS = [
  {
    icon: <RecycleIcon />,
    title: 'Separate Your Waste',
    desc: 'Sort recyclables from general waste to earn 5x more tokens.',
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    title: 'Compost Organic Waste',
    desc: 'Organic waste earns 5 tokens/kg and reduces landfill by 30%.',
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
    title: 'Report Illegal Dumping',
    desc: 'Earn 5 bonus tokens for every verified waste report you submit.',
  },
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card card-accent-green text-center py-8">
        <h1 className="text-lg font-bold text-txt-secondary mb-1">Welcome back,</h1>
        <h2 className="text-3xl font-black text-txt-primary mb-4">{user?.full_name || 'Citizen'}</h2>

        <div className="inline-flex flex-col items-center bg-accent-gold/10 border border-accent-gold/30 rounded-2xl px-8 py-4 mb-4">
          <div className="mb-1"><CoinIcon /></div>
          <div className="text-4xl font-black text-accent-gold glow-gold">
            {(wallet?.token_balance || 0).toLocaleString()}
          </div>
          <div className="text-xs text-txt-secondary mt-1 tracking-wider">TOKENS AVAILABLE</div>
        </div>

        <div className="flex justify-center gap-3">
          <Link to="/citizen/tokens" className="btn btn-gold text-sm flex items-center gap-2">
            <GiftIcon /> Redeem Tokens
          </Link>
          <Link to="/citizen/report" className="btn btn-ghost text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Report Waste
          </Link>
        </div>

        {(wallet?.streak_days || 0) > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-full px-4 py-2">
            <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
            <span className="text-sm font-bold text-warning">{wallet.streak_days}-day recycling streak!</span>
          </div>
        )}
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>, label: 'Total Recycled', value: `${(wallet?.total_waste_kg || 0).toFixed(1)} kg`, color: 'text-accent-green' },
          { icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, label: 'CO₂ Saved', value: `${co2Saved} kg`, color: 'text-accent-blue' },
          { icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>, label: 'Your Rank', value: dashboard?.leaderboard_rank ? `#${dashboard.leaderboard_rank}` : '—', color: 'text-accent-gold' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="card text-center">
            <div className="flex justify-center mb-1 text-txt-secondary">{s.icon}</div>
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
            <MapContainer center={[nearbyBins[0].location_lat, nearbyBins[0].location_lng]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
              {nearbyBins.map((bin) => {
                const color = bin.fill_level >= 80 ? '#ef4444' : bin.fill_level >= 50 ? '#f59e0b' : '#10b981'
                return (
                  <CircleMarker key={bin.bin_id} center={[parseFloat(bin.location_lat), parseFloat(bin.location_lng)]} radius={8} pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}>
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
                <div className="flex justify-center mb-2">
                  <svg className="w-8 h-8 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <p className="text-txt-secondary text-xs">Enable location to see nearby bins</p>
                <Link to="/citizen/map" className="text-accent-blue text-xs mt-1 block">Open full map</Link>
              </div>
            </div>
          )}
        </div>
        {nearbyBins.length > 0 && <p className="text-xs text-txt-secondary mt-2">{nearbyBins.length} bins within 1 km</p>}
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.action === 'earned' || tx.action === 'bonus' ? 'bg-accent-green/10 text-accent-green' : 'bg-critical/10 text-critical'}`}>
                    {tx.action === 'earned' ? <RecycleIcon /> : tx.action === 'bonus' ? <StarIcon /> : <GiftIcon />}
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
                  <div className={`text-sm font-bold flex items-center gap-1 justify-end ${tx.action === 'redeemed' ? 'text-critical' : 'text-accent-green'}`}>
                    {tx.action === 'redeemed' ? '-' : '+'}{tx.amount} <SmallCoinIcon />
                  </div>
                  {tx.blockchain_hash && <div className="hash-text truncate-hash">{tx.blockchain_hash}</div>}
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
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="card card-accent-green">
              <div className="mb-2 text-accent-green">{tip.icon}</div>
              <div className="text-sm font-bold text-txt-primary mb-1">{tip.title}</div>
              <div className="text-xs text-txt-secondary">{tip.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
