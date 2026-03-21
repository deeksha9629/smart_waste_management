/**
 * dataService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all data fetching.
 *
 * Set USE_REAL_API = true  → calls FastAPI backend via api.js
 * Set USE_REAL_API = false → returns rich mock data instantly (no backend needed)
 *
 * Every function returns a Promise<{ data, error }> so callers never need
 * try/catch — just destructure { data, error }.
 */

import {
  binsAPI, vehiclesAPI, routesAPI, collectionsAPI, predictionsAPI,
  municipalityAPI, citizensAPI, recyclingAPI, blockchainAPI, dashboardAPI,
} from './api'

// ── Toggle ────────────────────────────────────────────────────────────────────
export const USE_REAL_API = import.meta.env.VITE_USE_REAL_API !== 'false'

// ── Helper: wrap API call into { data, error } ────────────────────────────────
async function call(apiFn) {
  try {
    const res = await apiFn()
    return { data: res.data, error: null }
  } catch (err) {
    const msg = err.response?.data?.detail || err.message || 'Unknown error'
    return { data: null, error: msg }
  }
}

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK = {
  bins: Array.from({ length: 20 }, (_, i) => ({
    bin_id: `BIN-${String(i + 1).padStart(3, '0')}`,
    zone: `Zone ${String.fromCharCode(65 + (i % 5))}`,
    location_lat: 3.1390 + (Math.random() - 0.5) * 0.08,
    location_lng: 101.6869 + (Math.random() - 0.5) * 0.08,
    fill_level: Math.floor(Math.random() * 100),
    waste_type: ['general', 'recyclable', 'organic', 'hazardous', 'electronic'][i % 5],
    status: i % 7 === 0 ? 'maintenance' : 'active',
    last_collected: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
    sensor_battery: Math.floor(60 + Math.random() * 40),
    compliance_score: Math.floor(70 + Math.random() * 30),
  })),

  vehicles: Array.from({ length: 6 }, (_, i) => ({
    vehicle_id: `VH-${String(i + 1).padStart(3, '0')}`,
    plate_number: `WXY ${1000 + i * 111}`,
    vehicle_type: i % 2 === 0 ? 'compactor' : 'tipper',
    status: ['idle', 'collecting', 'en_route', 'maintenance', 'idle', 'collecting'][i],
    current_load_kg: Math.floor(Math.random() * 3000),
    capacity_kg: 5000,
    driver_name: ['Ahmad Razif', 'Siti Nora', 'Rajan Kumar', 'Lee Wei', 'Farid Aziz', 'Nurul Ain'][i],
    current_lat: 3.1390 + (Math.random() - 0.5) * 0.05,
    current_lng: 101.6869 + (Math.random() - 0.5) * 0.05,
    fuel_level: Math.floor(40 + Math.random() * 60),
    compliance_score: Math.floor(75 + Math.random() * 25),
  })),

  routes: Array.from({ length: 4 }, (_, i) => ({
    route_id: `RT-${String(i + 1).padStart(3, '0')}`,
    vehicle_id: `VH-${String(i + 1).padStart(3, '0')}`,
    status: ['active', 'completed', 'pending', 'active'][i],
    bin_sequence: [`BIN-00${i * 3 + 1}`, `BIN-00${i * 3 + 2}`, `BIN-00${i * 3 + 3}`],
    total_distance_km: parseFloat((5 + Math.random() * 15).toFixed(2)),
    estimated_duration_min: Math.floor(30 + Math.random() * 60),
    fuel_cost_estimate: parseFloat((8 + Math.random() * 12).toFixed(2)),
    created_at: new Date().toISOString(),
  })),

  collections: Array.from({ length: 15 }, (_, i) => ({
    event_id: `EVT-${String(i + 1).padStart(4, '0')}`,
    bin_id: `BIN-${String((i % 20) + 1).padStart(3, '0')}`,
    vehicle_id: `VH-${String((i % 6) + 1).padStart(3, '0')}`,
    waste_type: ['general', 'recyclable', 'organic', 'hazardous', 'electronic'][i % 5],
    fill_before: Math.floor(70 + Math.random() * 30),
    weight_kg: parseFloat((50 + Math.random() * 200).toFixed(1)),
    compliance_score: Math.floor(70 + Math.random() * 30),
    blockchain_hash: `0x${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    collected_at: new Date(Date.now() - i * 1800000).toISOString(),
  })),

  predictions: Array.from({ length: 20 }, (_, i) => ({
    bin_id: `BIN-${String(i + 1).padStart(3, '0')}`,
    current_fill: Math.floor(Math.random() * 100),
    predicted_6h: Math.min(100, Math.floor(Math.random() * 100 + 10)),
    predicted_12h: Math.min(100, Math.floor(Math.random() * 100 + 20)),
    priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
    confidence: parseFloat((0.7 + Math.random() * 0.3).toFixed(2)),
    predicted_at: new Date().toISOString(),
  })),

  alerts: Array.from({ length: 8 }, (_, i) => ({
    alert_id: `ALT-${String(i + 1).padStart(3, '0')}`,
    title: ['Bin Critical', 'Vehicle Overload', 'Compliance Violation', 'Sensor Offline'][i % 4],
    message: ['Fill level ≥90%', 'Load exceeds capacity', 'Score below threshold', 'No signal for 2h'][i % 4],
    severity: ['critical', 'high', 'medium', 'low'][i % 4],
    bin_id: i < 4 ? `BIN-${String(i + 1).padStart(3, '0')}` : null,
    is_resolved: false,
    created_at: new Date(Date.now() - i * 3600000).toISOString(),
  })),

  municipalityDashboard: {
    total_bins: 20,
    critical_bins: 4,
    total_vehicles: 6,
    active_vehicles: 3,
    collections_today: 28,
    unresolved_alerts: 5,
    avg_fill_level: 52,
    avg_compliance_score: 87,
    violations_today: 2,
    total_plants: 3,
    operational_plants: 3,
  },

  citizenTokens: {
    token_balance: 340,
    total_earned: 1250,
    total_redeemed: 910,
    streak_days: 7,
    rank: 12,
  },

  leaderboard: Array.from({ length: 10 }, (_, i) => ({
    user_id: `USR-${String(i + 1).padStart(3, '0')}`,
    full_name: ['Ahmad Razif', 'Siti Nora', 'Rajan Kumar', 'Lee Wei', 'Farid Aziz', 'Nurul Ain', 'Chong Mei', 'Priya S', 'Hafiz M', 'Zara L'][i],
    token_balance: Math.floor(1000 - i * 80 + Math.random() * 40),
    total_earned: Math.floor(2000 - i * 150),
    rank: i + 1,
  })),

  recyclingDashboard: {
    plant_name: 'KL Central Recycling Plant',
    current_load_kg: 12400,
    capacity_kg_per_day: 20000,
    capacity_pct: 62,
    intake_today: 18,
    processed_today: 14,
    pending_processing: 4,
    revenue_today: 3840,
  },

  intake: Array.from({ length: 12 }, (_, i) => ({
    intake_id: `INT-${String(i + 1).padStart(4, '0')}`,
    vehicle_id: `VH-${String((i % 6) + 1).padStart(3, '0')}`,
    waste_type: ['recyclable', 'organic', 'general', 'electronic', 'hazardous'][i % 5],
    weight_kg: parseFloat((200 + Math.random() * 800).toFixed(1)),
    processing_status: ['pending', 'processing', 'completed', 'rejected'][i % 4],
    blockchain_hash: `0x${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    received_at: new Date(Date.now() - i * 2400000).toISOString(),
  })),

  blockchainStats: {
    total_transactions: 1247,
    verified_count: 1241,
    failed_count: 6,
    by_type: { collection_event: 892, recycling_intake: 287, compliance_violation: 68 },
  },

  blockchainTxs: Array.from({ length: 20 }, (_, i) => ({
    log_id: `LOG-${String(i + 1).padStart(4, '0')}`,
    tx_type: ['collection_event', 'recycling_intake', 'compliance_violation'][i % 3],
    entity_id: `EVT-${String(i + 1).padStart(4, '0')}`,
    hash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    is_verified: i % 10 !== 0,
    created_at: new Date(Date.now() - i * 1800000).toISOString(),
  })),

  publicStats: {
    city_stats: {
      total_smart_bins: 20,
      total_waste_collected_kg: 48200,
      avg_fill_level_pct: 52,
      bins_needing_collection: 4,
    },
  },

  wasteReports: Array.from({ length: 6 }, (_, i) => ({
    report_id: `RPT-${String(i + 1).padStart(3, '0')}`,
    report_type: ['illegal_dumping', 'overflowing_bin', 'damaged_bin', 'missed_collection'][i % 4],
    description: 'Waste reported by citizen near the area.',
    location_lat: 3.1390 + (Math.random() - 0.5) * 0.05,
    location_lng: 101.6869 + (Math.random() - 0.5) * 0.05,
    status: ['pending', 'investigating', 'resolved'][i % 3],
    priority: ['low', 'medium', 'high'][i % 3],
    created_at: new Date(Date.now() - i * 7200000).toISOString(),
  })),
}

// ── Bins ──────────────────────────────────────────────────────────────────────
export const binService = {
  getAll:        () => USE_REAL_API ? call(() => binsAPI.getBins())          : Promise.resolve({ data: MOCK.bins, error: null }),
  getCritical:   (t) => USE_REAL_API ? call(() => binsAPI.getCritical(t))    : Promise.resolve({ data: MOCK.bins.filter(b => b.fill_level >= (t || 80)), error: null }),
  getById:       (id) => USE_REAL_API ? call(() => binsAPI.getBinById(id))   : Promise.resolve({ data: MOCK.bins.find(b => b.bin_id === id) || null, error: null }),
  getHistory:    (id, h) => USE_REAL_API ? call(() => binsAPI.getBinHistory(id, h)) : Promise.resolve({ data: Array.from({ length: 24 }, (_, i) => ({ recorded_at: new Date(Date.now() - i * 3600000).toISOString(), fill_level: Math.floor(Math.random() * 100) })), error: null }),
  getPrediction: (id) => USE_REAL_API ? call(() => binsAPI.getBinPrediction(id)) : Promise.resolve({ data: MOCK.predictions.find(p => p.bin_id === id) || MOCK.predictions[0], error: null }),
  collect:       (id, d) => USE_REAL_API ? call(() => binsAPI.collectBin(id, d)) : Promise.resolve({ data: { success: true }, error: null }),
  updateStatus:  (id, d) => USE_REAL_API ? call(() => binsAPI.updateBinStatus(id, d)) : Promise.resolve({ data: { success: true }, error: null }),
  getNearby:     (lat, lng, r) => USE_REAL_API ? call(() => binsAPI.getNearbyBins(lat, lng, r)) : Promise.resolve({ data: MOCK.bins.slice(0, 8).map(b => ({ ...b, distance_km: parseFloat((Math.random() * 2).toFixed(2)) })), error: null }),
}

// ── Vehicles ──────────────────────────────────────────────────────────────────
export const vehicleService = {
  getAll:    ()       => USE_REAL_API ? call(() => vehiclesAPI.getVehicles())       : Promise.resolve({ data: MOCK.vehicles, error: null }),
  getById:   (id)     => USE_REAL_API ? call(() => vehiclesAPI.getVehicle(id))      : Promise.resolve({ data: MOCK.vehicles.find(v => v.vehicle_id === id) || null, error: null }),
  getRoute:  (id)     => USE_REAL_API ? call(() => vehiclesAPI.getVehicleRoute(id)) : Promise.resolve({ data: MOCK.routes.find(r => r.vehicle_id === id) || null, error: null }),
  update:    (id, d)  => USE_REAL_API ? call(() => vehiclesAPI.updateStatus(id, d)) : Promise.resolve({ data: { success: true }, error: null }),
  add:       (d)      => USE_REAL_API ? call(() => vehiclesAPI.addVehicle(d))       : Promise.resolve({ data: { ...d, vehicle_id: `VH-NEW` }, error: null }),
}

// ── Routes ────────────────────────────────────────────────────────────────────
export const routeService = {
  getAll:    ()       => USE_REAL_API ? call(() => routesAPI.getRoutes())              : Promise.resolve({ data: MOCK.routes, error: null }),
  optimize:  ()       => USE_REAL_API ? call(() => routesAPI.optimizeRoutes())         : Promise.resolve({ data: { routes_created: MOCK.routes.length, message: 'Routes optimized (mock)' }, error: null }),
  getById:   (id)     => USE_REAL_API ? call(() => routesAPI.getRoute(id))             : Promise.resolve({ data: MOCK.routes.find(r => r.route_id === id) || null, error: null }),
  setStatus: (id, s)  => USE_REAL_API ? call(() => routesAPI.updateRouteStatus(id, s)) : Promise.resolve({ data: { success: true }, error: null }),
}

// ── Collections ───────────────────────────────────────────────────────────────
export const collectionService = {
  create:    (d)      => USE_REAL_API ? call(() => collectionsAPI.createCollection(d)) : Promise.resolve({ data: { event_id: 'EVT-NEW', ...d }, error: null }),
  getToday:  ()       => USE_REAL_API ? call(() => collectionsAPI.getToday())          : Promise.resolve({ data: { events: MOCK.collections }, error: null }),
  getHistory:(f, t, l)=> USE_REAL_API ? call(() => collectionsAPI.getHistory(f, t, l)) : Promise.resolve({ data: { events: MOCK.collections }, error: null }),
  getForBin: (id)     => USE_REAL_API ? call(() => collectionsAPI.getBinCollections(id)) : Promise.resolve({ data: { events: MOCK.collections.filter(c => c.bin_id === id) }, error: null }),
}

// ── Predictions ───────────────────────────────────────────────────────────────
export const predictionService = {
  getAll:     ()   => USE_REAL_API ? call(() => predictionsAPI.getAll())      : Promise.resolve({ data: { predictions: MOCK.predictions }, error: null }),
  getCritical:()   => USE_REAL_API ? call(() => predictionsAPI.getCritical()) : Promise.resolve({ data: { predictions: MOCK.predictions.filter(p => p.priority === 'critical') }, error: null }),
  getForBin:  (id) => USE_REAL_API ? call(() => predictionsAPI.getForBin(id)) : Promise.resolve({ data: MOCK.predictions.find(p => p.bin_id === id) || MOCK.predictions[0], error: null }),
  train:      ()   => USE_REAL_API ? call(() => predictionsAPI.train())       : Promise.resolve({ data: { message: 'Training complete (mock)', bins_trained: 20 }, error: null }),
  getAccuracy:()   => USE_REAL_API ? call(() => predictionsAPI.getAccuracy()) : Promise.resolve({ data: { mae: 4.2, rmse: 6.1, r2: 0.87 }, error: null }),
}

// ── Municipality ──────────────────────────────────────────────────────────────
export const municipalityService = {
  getDashboard:       ()        => USE_REAL_API ? call(() => municipalityAPI.getDashboard())          : Promise.resolve({ data: MOCK.municipalityDashboard, error: null }),
  getAlerts:          (sev)     => USE_REAL_API ? call(() => municipalityAPI.getAlerts(sev))          : Promise.resolve({ data: { alerts: sev ? MOCK.alerts.filter(a => a.severity === sev) : MOCK.alerts }, error: null }),
  createAlert:        (d)       => USE_REAL_API ? call(() => municipalityAPI.createAlert(d))          : Promise.resolve({ data: { alert_id: 'ALT-NEW', ...d }, error: null }),
  resolveAlert:       (id)      => USE_REAL_API ? call(() => municipalityAPI.resolveAlert(id))        : Promise.resolve({ data: { success: true }, error: null }),
  getReports:         (status)  => USE_REAL_API ? call(() => municipalityAPI.getReports(status))      : Promise.resolve({ data: { reports: status ? MOCK.wasteReports.filter(r => r.status === status) : MOCK.wasteReports }, error: null }),
  updateReportStatus: (id, s)   => USE_REAL_API ? call(() => municipalityAPI.updateReportStatus(id, s)) : Promise.resolve({ data: { success: true }, error: null }),
  getFleet:           ()        => USE_REAL_API ? call(() => municipalityAPI.getFleet())              : Promise.resolve({ data: { vehicles: MOCK.vehicles }, error: null }),
  getCompliance:      (days)    => USE_REAL_API ? call(() => municipalityAPI.getCompliance(days))     : Promise.resolve({ data: { compliance_rate: 87, violations: 2, events: [] }, error: null }),
  getZones:           ()        => USE_REAL_API ? call(() => municipalityAPI.getZones())              : Promise.resolve({ data: { zones: ['Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E'] }, error: null }),
  dispatch:           (vId, bIds) => USE_REAL_API ? call(() => municipalityAPI.dispatchVehicle(vId, bIds)) : Promise.resolve({ data: { success: true, message: 'Vehicle dispatched (mock)' }, error: null }),
}

// ── Citizens ──────────────────────────────────────────────────────────────────
export const citizenService = {
  getTokens:     ()    => USE_REAL_API ? call(() => citizensAPI.getMyTokens())    : Promise.resolve({ data: MOCK.citizenTokens, error: null }),
  getHistory:    ()    => USE_REAL_API ? call(() => citizensAPI.getHistory())     : Promise.resolve({ data: { transactions: MOCK.collections.slice(0, 8).map((c, i) => ({ ...c, tokens_earned: [10, 5, 2, 15, 20][i % 5], type: 'earned' })) }, error: null }),
  redeem:        (d)   => USE_REAL_API ? call(() => citizensAPI.redeem(d))        : Promise.resolve({ data: { success: true, new_balance: MOCK.citizenTokens.token_balance - (d.amount || 50) }, error: null }),
  getLeaderboard:(lim) => USE_REAL_API ? call(() => citizensAPI.getLeaderboard(lim)) : Promise.resolve({ data: { leaderboard: MOCK.leaderboard }, error: null }),
  report:        (d)   => USE_REAL_API ? call(() => citizensAPI.reportWaste(d))   : Promise.resolve({ data: { report_id: 'RPT-NEW', tokens_earned: 5, ...d }, error: null }),
  getMyReports:  ()    => USE_REAL_API ? call(() => citizensAPI.getMyReports())   : Promise.resolve({ data: { reports: MOCK.wasteReports.slice(0, 3) }, error: null }),
}

// ── Recycling ─────────────────────────────────────────────────────────────────
export const recyclingService = {
  getDashboard:       ()        => USE_REAL_API ? call(() => recyclingAPI.getDashboard())           : Promise.resolve({ data: MOCK.recyclingDashboard, error: null }),
  getIntake:          (plantId) => USE_REAL_API ? call(() => recyclingAPI.getIntake(plantId))       : Promise.resolve({ data: { intake: MOCK.intake }, error: null }),
  recordIntake:       (d)       => USE_REAL_API ? call(() => recyclingAPI.recordIntake(d))          : Promise.resolve({ data: { intake_id: 'INT-NEW', ...d }, error: null }),
  updateIntakeStatus: (id, s)   => USE_REAL_API ? call(() => recyclingAPI.updateIntakeStatus(id, s)) : Promise.resolve({ data: { success: true }, error: null }),
  getCapacity:        ()        => USE_REAL_API ? call(() => recyclingAPI.getCapacity())            : Promise.resolve({ data: { plants: [{ plant_name: 'KL Central', capacity_pct: 62 }] }, error: null }),
  getBlockchain:      ()        => USE_REAL_API ? call(() => recyclingAPI.getBlockchainRecords())   : Promise.resolve({ data: { records: MOCK.blockchainTxs.filter(t => t.tx_type === 'recycling_intake') }, error: null }),
  getReports:         (days)    => USE_REAL_API ? call(() => recyclingAPI.getReports(days))         : Promise.resolve({ data: { summary: MOCK.recyclingDashboard }, error: null }),
}

// ── Blockchain ────────────────────────────────────────────────────────────────
export const blockchainService = {
  getTransactions: (lim, type) => USE_REAL_API ? call(() => blockchainAPI.getTransactions(lim, type)) : Promise.resolve({ data: { transactions: type ? MOCK.blockchainTxs.filter(t => t.tx_type === type) : MOCK.blockchainTxs }, error: null }),
  getStats:        ()          => USE_REAL_API ? call(() => blockchainAPI.getStats())                 : Promise.resolve({ data: MOCK.blockchainStats, error: null }),
  getBinHistory:   (id)        => USE_REAL_API ? call(() => blockchainAPI.getBinHistory(id))          : Promise.resolve({ data: { transactions: MOCK.blockchainTxs.slice(0, 5) }, error: null }),
  verify:          (id)        => USE_REAL_API ? call(() => blockchainAPI.verifyEvent(id))            : Promise.resolve({ data: { verified: true, match: true }, error: null }),
  getContract:     ()          => USE_REAL_API ? call(() => blockchainAPI.getContract())              : Promise.resolve({ data: { address: '0xMOCK...CONTRACT', network: 'mock' }, error: null }),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardService = {
  getMunicipality: () => USE_REAL_API ? call(() => dashboardAPI.getMunicipality()) : Promise.resolve({ data: MOCK.municipalityDashboard, error: null }),
  getCitizen:      () => USE_REAL_API ? call(() => dashboardAPI.getCitizen())      : Promise.resolve({ data: MOCK.citizenTokens, error: null }),
  getRecycling:    () => USE_REAL_API ? call(() => dashboardAPI.getRecycling())    : Promise.resolve({ data: MOCK.recyclingDashboard, error: null }),
  getPublic:       () => USE_REAL_API ? call(() => dashboardAPI.getPublic())       : Promise.resolve({ data: MOCK.publicStats, error: null }),
}
