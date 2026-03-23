import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import toast from 'react-hot-toast'
import { binService } from '../../services/dataService'
import { realtimeService } from '../../services/realtimeService'

const FILL_COLOR = (fill) => {
  if (fill >= 90) return '#ef4444'
  if (fill >= 75) return '#f97316'
  if (fill >= 50) return '#f59e0b'
  return '#10b981'
}

// Keeps map centered when center prop changes
function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => { if (center) map.setView(center, map.getZoom()) }, [center, map])
  return null
}

export default function MapView() {
  const [bins,    setBins]    = useState([])
  const [filter,  setFilter]  = useState('all')
  const [loading, setLoading] = useState(true)
  const [rtCount, setRtCount] = useState(0)   // realtime update counter for badge
  const binsRef = useRef([])                   // mutable ref so Realtime callback sees latest bins
  const CENTER  = [3.1390, 101.6869]           // Kuala Lumpur default

  // ── Initial load + 15 s polling fallback ──────────────────────────────────
  const load = useCallback(async () => {
    const { data, error } = await binService.getAll()
    if (error) { toast.error('Failed to load bins'); setLoading(false); return }
    const list = Array.isArray(data) ? data : (data?.bins || [])
    setBins(list)
    binsRef.current = list
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  // ── Supabase Realtime: bins table → instant marker update ─────────────────
  useEffect(() => {
    const unsub = realtimeService.onBinChange((payload) => {
      if (!payload.new) return
      const updated = payload.new

      setBins((prev) => {
        const idx = prev.findIndex((b) => b.bin_id === updated.bin_id)
        if (idx === -1) return [...prev, updated]          // INSERT
        if (payload.eventType === 'DELETE') return prev.filter((b) => b.bin_id !== updated.bin_id)
        const next = [...prev]
        next[idx] = { ...prev[idx], ...updated }           // UPDATE — merge so no field is lost
        binsRef.current = next
        return next
      })

      setRtCount((n) => n + 1)

      // Toast only for critical threshold crossings
      const prev = binsRef.current.find((b) => b.bin_id === updated.bin_id)
      if (updated.fill_level >= 90 && (prev?.fill_level ?? 0) < 90) {
        toast.error(`${updated.bin_id} critical — ${updated.fill_level}% full`)
      }
    })
    return unsub
  }, [])

  const filtered = bins.filter((b) => {
    if (filter === 'critical') return b.fill_level >= 80
    if (filter === 'warning')  return b.fill_level >= 50 && b.fill_level < 80
    if (filter === 'ok')       return b.fill_level < 50
    return true
  })

  const stats = {
    total:    bins.length,
    critical: bins.filter((b) => b.fill_level >= 80).length,
    warning:  bins.filter((b) => b.fill_level >= 50 && b.fill_level < 80).length,
    ok:       bins.filter((b) => b.fill_level < 50).length,
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">LIVE BIN MAP</h1>
          <p className="text-xs text-txt-secondary mt-1">
            Real-time sensor data · Auto-refresh every 15 s
            {rtCount > 0 && (
              <span className="ml-2 text-accent-green font-semibold">
                · {rtCount} live update{rtCount !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="pulse-dot pulse-dot-green"><div className="w-2 h-2 rounded-full bg-accent-green" /></div>
          <span className="text-xs text-accent-green font-semibold">LIVE</span>
        </div>
      </div>

      {/* Filter stat cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Bins', value: stats.total,    color: 'text-accent-blue',  key: 'all'      },
          { label: 'Critical',   value: stats.critical, color: 'text-critical',     key: 'critical' },
          { label: 'Warning',    value: stats.warning,  color: 'text-warning',      key: 'warning'  },
          { label: 'OK',         value: stats.ok,       color: 'text-accent-green', key: 'ok'       },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`card text-left transition-all ${filter === s.key ? 'border-accent-blue' : ''}`}
          >
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-txt-secondary mt-1 uppercase tracking-wider">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="card p-0 overflow-hidden" style={{ height: 520 }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="spinner spinner-lg" />
          </div>
        ) : (
          <MapContainer center={CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            {filtered.map((bin) => {
              const lat = parseFloat(bin.location_lat)
              const lng = parseFloat(bin.location_lng)
              if (isNaN(lat) || isNaN(lng)) return null
              const color = FILL_COLOR(bin.fill_level || 0)
              return (
                <CircleMarker
                  key={bin.bin_id}
                  center={[lat, lng]}
                  radius={bin.fill_level >= 80 ? 10 : 7}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
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
                      <div className="flex justify-between text-xs mt-1">
                        <span>Type</span><span>{bin.waste_type || '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Zone</span><span>{bin.zone || '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Battery</span><span>{bin.sensor_battery ?? bin.battery_level ?? '—'}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Status</span>
                        <span className={`badge ${bin.status === 'active' ? 'badge-green' : 'badge-orange'}`}>
                          {bin.status}
                        </span>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        )}
      </div>

      {/* Legend */}
      <div className="card flex flex-wrap items-center gap-6 py-3">
        <span className="text-xs text-txt-secondary font-semibold">LEGEND:</span>
        {[
          { color: '#10b981', label: '0–49% OK'        },
          { color: '#f59e0b', label: '50–74% Warning'   },
          { color: '#f97316', label: '75–89% High'      },
          { color: '#ef4444', label: '90–100% Critical'  },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
            <span className="text-xs text-txt-secondary">{l.label}</span>
          </div>
        ))}
        <div className="ml-auto text-xs text-txt-secondary">
          Showing <strong className="text-txt-primary">{filtered.length}</strong> of {bins.length} bins
        </div>
      </div>
    </div>
  )
}
