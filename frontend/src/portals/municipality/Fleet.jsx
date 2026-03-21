import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { vehiclesAPI, municipalityAPI, binsAPI } from '../../services/api'
import toast from 'react-hot-toast'

const STATUS_BADGE = {
  available:   'badge-green',
  collecting:  'badge-blue',
  full:        'badge-orange',
  maintenance: 'badge-gold',
  offline:     'badge-gray',
}

const STATUS_OPTIONS = ['available', 'collecting', 'full', 'maintenance', 'offline']

export default function FleetManagement() {
  const [vehicles,   setVehicles]   = useState([])
  const [bins,       setBins]       = useState([])
  const [fleet,      setFleet]      = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [updating,   setUpdating]   = useState(null)
  const [dispatch,   setDispatch]   = useState({ vehicleId: '', binIds: '' })
  const [dispatching,setDispatching]= useState(false)
  const [addForm,    setAddForm]    = useState({ vehicle_number: '', driver_name: '', driver_phone: '', capacity_kg: 5000, assigned_zone: '' })
  const [adding,     setAdding]     = useState(false)
  const [showAdd,    setShowAdd]    = useState(false)

  const load = useCallback(async () => {
    try {
      const [v, f, b] = await Promise.all([
        vehiclesAPI.getVehicles(),
        municipalityAPI.getFleet(),
        binsAPI.getCritical(80),
      ])
      setVehicles(v.data || [])
      setFleet(f.data)
      setBins(b.data?.bins || [])
    } catch { toast.error('Failed to load fleet data') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setInterval(load, 20000); return () => clearInterval(t) }, [load])

  const handleStatusUpdate = async (vehicleId, status) => {
    setUpdating(vehicleId)
    try {
      await vehiclesAPI.updateStatus(vehicleId, { status })
      toast.success(`Vehicle ${vehicleId} → ${status}`)
      load()
    } catch { toast.error('Failed to update vehicle status') }
    finally { setUpdating(null) }
  }

  const handleDispatch = async (e) => {
    e.preventDefault()
    if (!dispatch.vehicleId || !dispatch.binIds) { toast.error('Vehicle ID and bin IDs are required'); return }
    const binIds = dispatch.binIds.split(',').map((b) => b.trim()).filter(Boolean)
    if (binIds.length === 0) { toast.error('Enter at least one bin ID'); return }
    setDispatching(true)
    try {
      const res = await municipalityAPI.dispatchVehicle(dispatch.vehicleId, binIds)
      toast.success(res.data.message)
      setDispatch({ vehicleId: '', binIds: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Dispatch failed')
    } finally {
      setDispatching(false)
    }
  }

  const handleAddVehicle = async (e) => {
    e.preventDefault()
    if (!addForm.vehicle_number) { toast.error('Vehicle number is required'); return }
    setAdding(true)
    try {
      await vehiclesAPI.addVehicle({ ...addForm, capacity_kg: parseFloat(addForm.capacity_kg) })
      toast.success('Vehicle added!')
      setShowAdd(false)
      setAddForm({ vehicle_number: '', driver_name: '', driver_phone: '', capacity_kg: 5000, assigned_zone: '' })
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add vehicle')
    } finally {
      setAdding(false)
    }
  }

  const setAdd = (k) => (e) => setAddForm((f) => ({ ...f, [k]: e.target.value }))

  if (loading) return <div className="flex justify-center py-20"><div className="spinner spinner-lg" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-black tracking-[0.15em] text-txt-primary">FLEET MANAGEMENT</h1>
          <p className="text-xs text-txt-secondary mt-1">
            {vehicles.length} vehicles · Auto-refresh every 20s
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary text-xs">
          {showAdd ? '✕ Cancel' : '+ Add Vehicle'}
        </button>
      </div>

      {/* Fleet summary */}
      {fleet && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Vehicles', value: fleet.total_vehicles,                                    color: 'text-txt-primary'  },
            { label: 'Collecting',     value: fleet.by_status?.collecting || 0,                        color: 'text-accent-blue'  },
            { label: 'Available',      value: fleet.by_status?.available  || 0,                        color: 'text-accent-green' },
            { label: 'Fleet Load',     value: `${fleet.fleet_load_pct || 0}%`,                         color: 'text-accent-gold'  },
          ].map((s) => (
            <div key={s.label} className="card text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-txt-secondary mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add vehicle form */}
      {showAdd && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="card card-accent-green"
        >
          <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">ADD NEW VEHICLE</h3>
          <form onSubmit={handleAddVehicle} className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Vehicle Number *</label>
              <input type="text" className="input text-xs" placeholder="e.g. MUN-001" value={addForm.vehicle_number} onChange={setAdd('vehicle_number')} />
            </div>
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Driver Name</label>
              <input type="text" className="input text-xs" placeholder="Driver name" value={addForm.driver_name} onChange={setAdd('driver_name')} />
            </div>
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Driver Phone</label>
              <input type="text" className="input text-xs" placeholder="+1234567890" value={addForm.driver_phone} onChange={setAdd('driver_phone')} />
            </div>
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Capacity (kg)</label>
              <input type="number" className="input text-xs" value={addForm.capacity_kg} onChange={setAdd('capacity_kg')} />
            </div>
            <div>
              <label className="text-xs text-txt-secondary block mb-1">Assigned Zone</label>
              <input type="text" className="input text-xs" placeholder="Zone A" value={addForm.assigned_zone} onChange={setAdd('assigned_zone')} />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={adding} className="btn btn-success w-full text-xs">
                {adding ? <span className="spinner" /> : '+ Add Vehicle'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Dispatch panel */}
      <div className="card card-accent-blue">
        <h3 className="text-xs font-bold tracking-widest text-txt-secondary mb-4">MANUAL DISPATCH</h3>
        <form onSubmit={handleDispatch} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="text-xs text-txt-secondary block mb-1">Vehicle ID</label>
            <select
              className="input text-xs"
              value={dispatch.vehicleId}
              onChange={(e) => setDispatch((d) => ({ ...d, vehicleId: e.target.value }))}
            >
              <option value="">Select vehicle</option>
              {vehicles.filter((v) => v.status === 'available').map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.vehicle_id} — {v.vehicle_number || 'No plate'} ({v.assigned_zone || 'No zone'})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-60">
            <label className="text-xs text-txt-secondary block mb-1">
              Bin IDs (comma-separated) — {bins.length} critical bins available
            </label>
            <input
              type="text"
              className="input text-xs"
              placeholder="BIN-001, BIN-002, BIN-003"
              value={dispatch.binIds}
              onChange={(e) => setDispatch((d) => ({ ...d, binIds: e.target.value }))}
            />
          </div>
          <button type="submit" disabled={dispatching} className="btn btn-primary text-xs py-2.5">
            {dispatching ? <span className="spinner" /> : '🚛'}
            {dispatching ? 'DISPATCHING...' : 'DISPATCH'}
          </button>
        </form>
        {bins.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            <span className="text-[10px] text-txt-secondary mr-1">Critical bins:</span>
            {bins.slice(0, 12).map((b) => (
              <button
                key={b.bin_id}
                type="button"
                onClick={() => setDispatch((d) => ({
                  ...d,
                  binIds: d.binIds ? `${d.binIds}, ${b.bin_id}` : b.bin_id,
                }))}
                className="badge badge-red cursor-pointer hover:opacity-80 text-[9px]"
              >
                {b.bin_id} ({b.fill_level}%)
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Vehicle grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vehicles.map((v, i) => (
          <motion.div
            key={v.vehicle_id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="card"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-accent-blue">{v.vehicle_id}</span>
                  <span className={`badge ${STATUS_BADGE[v.status] || 'badge-gray'}`}>{v.status}</span>
                </div>
                <div className="text-xs text-txt-secondary mt-0.5">{v.vehicle_number || 'No plate'}</div>
              </div>
              <span className="text-2xl">🚛</span>
            </div>

            {/* Load bar */}
            <div className="mb-3">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-txt-secondary">Load</span>
                <span className="text-txt-primary">{v.current_load_kg?.toFixed(0) || 0} / {v.capacity_kg?.toFixed(0) || 5000} kg</span>
              </div>
              <div className="fill-bar">
                <div
                  className="fill-bar-inner"
                  style={{
                    width: `${Math.min(100, ((v.current_load_kg || 0) / (v.capacity_kg || 5000)) * 100)}%`,
                    background: ((v.current_load_kg || 0) / (v.capacity_kg || 5000)) > 0.9 ? '#ef4444' : '#0ea5e9',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div><span className="text-txt-secondary">Driver: </span><span>{v.driver_name || '—'}</span></div>
              <div><span className="text-txt-secondary">Zone: </span><span>{v.assigned_zone || '—'}</span></div>
              <div><span className="text-txt-secondary">Fuel: </span><span className={v.fuel_level < 20 ? 'text-critical' : 'text-accent-green'}>{v.fuel_level || 0}%</span></div>
              <div><span className="text-txt-secondary">Type: </span><span>{v.vehicle_type?.replace(/_/g, ' ') || '—'}</span></div>
            </div>

            {/* Status change */}
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.filter((s) => s !== v.status).map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusUpdate(v.vehicle_id, s)}
                  disabled={updating === v.vehicle_id}
                  className="btn btn-ghost text-[10px] py-1 px-2"
                >
                  → {s}
                </button>
              ))}
            </div>

            {v.last_updated && (
              <div className="text-[9px] text-txt-secondary mt-2">
                Updated: {format(new Date(v.last_updated), 'HH:mm:ss')}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
