import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { routesAPI } from '../../services/api'
import toast from 'react-hot-toast'

const STATUS_BADGE = {
  pending:   'badge-gold',
  active:    'badge-green',
  completed: 'badge-blue',
  cancelled: 'badge-gray',
}

export default function Routes() {
  const [routes,     setRoutes]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [optimizing, setOptimizing] = useState(false)
  const [result,     setResult]     = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await routesAPI.getRoutes()
      setRoutes(res.data?.routes || res.data || [])
    } catch { toast.error('Failed to load routes') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleOptimize = async () => {
    setOptimizing(true)
    setResult(null)
    try {
      const res = await routesAPI.optimizeRoutes()
      setResult(res.data)
      toast.success(`${res.data.routes_created} optimized routes generated!`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Optimization failed')
    } finally {
      setOptimizing(false)
    }
  }

  const handleStatusUpdate = async (routeId, status) => {
    try {
      await routesAPI.updateRouteStatus(routeId, status)
      toast.success(`Route ${status}`)
      load()
    } catch { toast.error('Failed to update route') }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">ROUTE OPTIMIZER</h1>
          <p className="text-xs text-txt-secondary mt-1">AI-powered nearest-neighbour route optimization</p>
        </div>
        <button onClick={handleOptimize} disabled={optimizing} className="btn btn-primary">
          {optimizing ? <span className="spinner" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
          {optimizing ? 'OPTIMIZING...' : 'OPTIMIZE ALL ROUTES'}
        </button>
      </div>

      {/* AI loading animation */}
      <AnimatePresence>
        {optimizing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card card-accent-blue"
          >
            <div className="flex items-center gap-4 py-2">
              <div className="spinner spinner-lg" />
              <div>
                <div className="text-sm font-bold text-accent-blue">AI Route Agent Running...</div>
                <div className="text-xs text-txt-secondary mt-1">
                  Fetching critical bins → Distributing across vehicles → Calculating nearest-neighbour paths → Saving routes
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optimization result */}
      {result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card card-accent-green">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Routes Created',    value: result.routes_created,    color: 'text-accent-green' },
              { label: 'Bins Covered',      value: result.bins_covered,      color: 'text-accent-blue'  },
              { label: 'Vehicles Assigned', value: result.vehicles_assigned, color: 'text-accent-gold'  },
              { label: 'Status',            value: 'OPTIMIZED',              color: 'text-accent-green' },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <div className={`text-2xl font-black ${m.color}`}>{m.value}</div>
                <div className="text-[10px] text-txt-secondary mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Routes list */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner spinner-lg" /></div>
      ) : routes.length === 0 ? (
        <div className="card text-center py-12">
          <div className="flex justify-center mb-3"><svg className="w-12 h-12 text-txt-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg></div>
          <p className="text-txt-secondary">No routes generated today. Click "Optimize All Routes" to start.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map((route, i) => (
            <motion.div
              key={route.route_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card card-accent-blue"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-accent-blue">{route.route_id}</span>
                    <span className={`badge ${STATUS_BADGE[route.status] || 'badge-gray'}`}>{route.status}</span>
                  </div>
                  <div className="text-xs text-txt-secondary mt-1">Vehicle: <strong className="text-txt-primary">{route.vehicle_id}</strong></div>
                </div>
                <div className="flex gap-2">
                  {route.status === 'pending' && (
                    <button onClick={() => handleStatusUpdate(route.route_id, 'active')} className="btn btn-success text-xs py-1.5 px-3">
                      Start Route
                    </button>
                  )}
                  {route.status === 'active' && (
                    <button onClick={() => handleStatusUpdate(route.route_id, 'completed')} className="btn btn-primary text-xs py-1.5 px-3">
                      Complete
                    </button>
                  )}
                  {['pending','active'].includes(route.status) && (
                    <button onClick={() => handleStatusUpdate(route.route_id, 'cancelled')} className="btn btn-ghost text-xs py-1.5 px-3">
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Bins',          value: route.total_bins,                    unit: '' },
                  { label: 'Distance',      value: route.total_distance_km?.toFixed(1), unit: ' km' },
                  { label: 'Saved',         value: route.distance_saved_km?.toFixed(1), unit: ' km', color: 'text-accent-green' },
                  { label: 'Duration',      value: route.estimated_duration_minutes,    unit: ' min' },
                  { label: 'Fuel Cost',     value: `₹${route.fuel_cost?.toFixed(2)}`,   unit: '' },
                  { label: 'Fuel Saved',    value: `$${route.fuel_saved?.toFixed(2)}`,  unit: '', color: 'text-accent-green' },
                ].map((m) => (
                  <div key={m.label} className="bg-bg-secondary rounded-lg p-2 border border-border-dim text-center">
                    <div className={`text-sm font-bold ${m.color || 'text-txt-primary'}`}>{m.value}{m.unit}</div>
                    <div className="text-[9px] text-txt-secondary mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              {route.route_data?.bins && (
                <div className="mt-3 pt-3 border-t border-border-dim">
                  <p className="text-[10px] text-txt-secondary mb-1">BIN SEQUENCE:</p>
                  <div className="flex flex-wrap gap-1">
                    {route.route_data.bins.map((bid, j) => (
                      <span key={j} className="badge badge-blue text-[9px]">{j+1}. {bid}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-2 text-[10px] text-txt-secondary">
                Generated: {route.created_at ? format(new Date(route.created_at), 'MMM d, HH:mm') : '—'} · By: {route.generated_by}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
