import { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import toast from 'react-hot-toast'
import { useAuth } from '../../auth/AuthContext'
import { binService } from '../../services/dataService'
import { realtimeService } from '../../services/realtimeService'

const TOKENS_PER_KG = { recyclable: 10, organic: 5, general: 2, hazardous: 15, electronic: 20 }
const FILL_COLOR    = (fill) => fill >= 90 ? '#ef4444' : fill >= 75 ? '#f97316' : fill >= 50 ? '#f59e0b' : '#10b981'

const userIcon = L.divIcon({
  html: '<div style="width:16px;height:16px;background:#0ea5e9;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(14,165,233,0.8)"></div>',
  iconSize: [16, 16], iconAnchor: [8, 8], className: '',
})

function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.setView(center, 15) }, [center, map])
  return null
}

export default function NearbyBins() {
  const { token } = useAuth()
  const [bins,     setBins]     = useState([])
  const [userPos,  setUserPos]  = useState(null)
  const [radius,   setRadius]   = useState(5)
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState(null)
  const [wsReady,  setWsReady]  = useState(false)
  const DEFAULT_CENTER = [3.1390, 101.6869]

  // ── REST fallback fetch ────────────────────────────────────────────────────
  const fetchNearby = useCallback(async (lat, lng) => {
    setLoading(true)
    const { data, error } = await binService.getNearby(lat, lng, radius)
    if (error) toast.error('Failed to load nearby bins')
    else setBins(Array.isArray(data) ? data : (data?.bins || []))
    setLoading(false)
  }, [radius])

  // ── Get browser location ───────────────────────────────────────────────────
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setUserPos([lat, lng])
        // Prefer WS push if connected, else REST
        if (wsReady) {
          realtimeService.sendLocation(lat, lng, radius)
        } else {
          fetchNearby(lat, lng)
        }
      },
      () => toast.error('Location access denied')
    )
  }, [wsReady, radius, fetchNearby])

  useEffect(() => { getLocation() }, [])   // on mount

  // Re-fetch when radius changes
  useEffect(() => {
    if (userPos) fetchNearby(userPos[0], userPos[1])
  }, [radius])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── FastAPI WebSocket: receive nearby_bins push ────────────────────────────
  useEffect(() => {
    if (!token) return

    const unsub = realtimeService.onWSMessage((msg) => {
      if (msg.type === 'connected') {
        setWsReady(true)
        // Send location immediately once WS is ready
        if (userPos) realtimeService.sendLocation(userPos[0], userPos[1], radius)
      } else if (msg.type === 'nearby_bins') {
        setBins(msg.data || [])
        setLoading(false)
      } else if (msg.type === 'citizen_update') {
        // Citizen push also carries available_bins — use as fallback
        if (!userPos && msg.data?.available_bins?.length) {
          setBins(msg.data.available_bins)
        }
      }
    })

    // Connect WS (no-op if already connected from Dashboard)
    realtimeService.connectWS(token, () => {})

    return unsub
  }, [token, userPos, radius])

  const center = userPos || DEFAULT_CENTER

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">NEARBY BINS</h1>
          <p className="text-xs text-txt-secondary mt-1">
            {bins.length} bins within {radius} km
            {wsReady && <span className="ml-2 text-accent-green font-semibold">· WS LIVE</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="input w-32 text-xs py-2"
          >
            {[1, 2, 5, 10].map((r) => <option key={r} value={r}>{r} km radius</option>)}
          </select>
          <button onClick={getLocation} className="btn btn-primary text-xs py-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            My Location
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 card p-0 overflow-hidden" style={{ height: 480 }}>
          <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            {userPos && (
              <>
                <RecenterMap center={userPos} />
                <Marker position={userPos} icon={userIcon}>
                  <Popup><div className="text-xs font-bold text-accent-blue">Your Location</div></Popup>
                </Marker>
              </>
            )}
            {bins.map((bin) => {
              const lat = parseFloat(bin.location_lat)
              const lng = parseFloat(bin.location_lng)
              if (isNaN(lat) || isNaN(lng)) return null
              const color  = FILL_COLOR(bin.fill_level || 0)
              const reward = TOKENS_PER_KG[bin.waste_type] || 2
              return (
                <CircleMarker
                  key={bin.bin_id}
                  center={[lat, lng]}
                  radius={bin.fill_level >= 80 ? 10 : 7}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
                  eventHandlers={{ click: () => setSelected(bin) }}
                >
                  <Popup>
                    <div className="text-sm space-y-1">
                      <div className="font-bold text-accent-blue">{bin.bin_id}</div>
                      <div className="text-txt-secondary text-xs">{bin.address || bin.zone || 'No address'}</div>
                      <div className="flex justify-between">
                        <span>Fill Level</span>
                        <strong style={{ color }}>{bin.fill_level}%</strong>
                      </div>
                      <div className="fill-bar">
                        <div className="fill-bar-inner" style={{ width: `${bin.fill_level}%`, background: color }} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Type</span><span>{bin.waste_type || '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Distance</span><span>{bin.distance_km ?? '—'} km</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Token Rate</span>
                        <span className="text-accent-gold font-bold flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {reward}/kg
                        </span>
                      </div>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer" className="block text-center text-xs text-accent-blue mt-1 hover:underline flex items-center justify-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                        Navigate Here
                      </a>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>

        {/* Bin list panel */}
        <div className="card overflow-y-auto" style={{ maxHeight: 480 }}>
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-3">BIN LIST</h3>
          {loading ? (
            <div className="flex justify-center py-8"><div className="spinner" /></div>
          ) : bins.length === 0 ? (
            <p className="text-txt-secondary text-xs text-center py-6">No bins found nearby</p>
          ) : (
            <div className="space-y-2">
              {bins.map((bin) => {
                const color  = FILL_COLOR(bin.fill_level || 0)
                const reward = TOKENS_PER_KG[bin.waste_type] || 2
                return (
                  <div
                    key={bin.bin_id}
                    onClick={() => setSelected(bin)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selected?.bin_id === bin.bin_id
                        ? 'border-accent-blue bg-accent-blue/5'
                        : 'border-border-dim hover:border-accent-blue/40'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs font-bold text-accent-blue">{bin.bin_id}</span>
                      <span className="text-[10px] text-txt-secondary">{bin.distance_km ?? '—'} km</span>
                    </div>
                    <div className="fill-bar mb-1">
                      <div className="fill-bar-inner" style={{ width: `${bin.fill_level}%`, background: color }} />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span style={{ color }}>{bin.fill_level}% full</span>
                      <span className="text-accent-gold flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {reward}/kg
                        </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
