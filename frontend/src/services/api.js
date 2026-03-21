import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach JWT ──────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sw_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor: handle errors ──────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sw_token')
      localStorage.removeItem('sw_user')
      window.location.href = '/login'
    } else if (!error.response) {
      toast.error('Network error — check your connection')
    }
    return Promise.reject(error)
  }
)

// ── AUTH ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:    (email, password) => api.post('/auth/login',    { email, password }),
  register: (userData)        => api.post('/auth/register', userData),
  logout:   ()                => api.post('/auth/logout'),
  getMe:    ()                => api.get('/auth/me'),
}

// ── BINS ──────────────────────────────────────────────────────────────────────
export const binsAPI = {
  getBins:         ()                    => api.get('/bins/'),
  getCritical:     (threshold = 80)      => api.get(`/bins/critical?threshold=${threshold}`),
  getBinById:      (id)                  => api.get(`/bins/${id}`),
  getBinHistory:   (id, hours = 24)      => api.get(`/bins/${id}/history?hours=${hours}`),
  getBinPrediction:(id)                  => api.get(`/bins/${id}/prediction`),
  collectBin:      (id, data)            => api.post(`/bins/${id}/collect`, data),
  updateBinStatus: (id, data)            => api.put(`/bins/${id}/status`, data),
  getBinsByZone:   (zone)                => api.get(`/bins/zone/${zone}`),
  getNearbyBins:   (lat, lng, radius=2)  => api.get(`/citizens/nearby-bins?lat=${lat}&lng=${lng}&radius_km=${radius}`),
}

// ── VEHICLES ──────────────────────────────────────────────────────────────────
export const vehiclesAPI = {
  getVehicles:       ()           => api.get('/vehicles/'),
  getVehicle:        (id)         => api.get(`/vehicles/${id}`),
  getVehicleRoute:   (id)         => api.get(`/vehicles/${id}/route`),
  updateStatus:      (id, data)   => api.put(`/vehicles/${id}/status`, data),
  addVehicle:        (data)       => api.post('/vehicles/', data),
}

// ── ROUTES ────────────────────────────────────────────────────────────────────
export const routesAPI = {
  getRoutes:         ()           => api.get('/routes/'),
  optimizeRoutes:    ()           => api.post('/routes/optimize'),
  getRoute:          (id)         => api.get(`/routes/${id}`),
  updateRouteStatus: (id, status) => api.put(`/routes/${id}/status`, { status }),
  getVehicleRoutes:  (vehicleId)  => api.get(`/routes/vehicle/${vehicleId}`),
}

// ── COLLECTIONS ───────────────────────────────────────────────────────────────
export const collectionsAPI = {
  createCollection:  (data)                => api.post('/collections/', data),
  getToday:          ()                    => api.get('/collections/today'),
  getHistory:        (from, to, limit=100) => api.get(`/collections/history?from_date=${from||''}&to_date=${to||''}&limit=${limit}`),
  getEvent:          (id)                  => api.get(`/collections/${id}`),
  getBinCollections: (binId)               => api.get(`/collections/bin/${binId}`),
}

// ── PREDICTIONS ───────────────────────────────────────────────────────────────
export const predictionsAPI = {
  getAll:      ()    => api.get('/predictions/'),
  getCritical: ()    => api.get('/predictions/critical'),
  getForBin:   (id)  => api.get(`/predictions/${id}`),
  train:       ()    => api.post('/predictions/train'),
  getAccuracy: ()    => api.get('/predictions/accuracy'),
}

// ── MUNICIPALITY ──────────────────────────────────────────────────────────────
export const municipalityAPI = {
  getDashboard:       ()           => api.get('/municipality/dashboard'),
  getAlerts:          (severity)   => api.get(`/municipality/alerts${severity ? `?severity=${severity}` : ''}`),
  createAlert:        (data)       => api.post('/municipality/alerts', data),
  resolveAlert:       (id)         => api.put(`/municipality/alerts/${id}/resolve`),
  getReports:         (status)     => api.get(`/municipality/reports${status ? `?status=${status}` : ''}`),
  updateReportStatus: (id, status) => api.put(`/municipality/reports/${id}/status`, { status }),
  getFleet:           ()           => api.get('/municipality/vehicles/all'),
  getCompliance:      (days=7)     => api.get(`/municipality/compliance?days=${days}`),
  getZones:           ()           => api.get('/municipality/zones'),
  dispatchVehicle:    (vehicleId, binIds) => api.post('/municipality/dispatch', { vehicle_id: vehicleId, bin_ids: binIds }),
}

// ── CITIZENS ──────────────────────────────────────────────────────────────────
export const citizensAPI = {
  getMyTokens:   ()      => api.get('/citizens/tokens'),
  getHistory:    ()      => api.get('/citizens/history'),
  redeem:        (data)  => api.post('/citizens/redeem', data),
  getLeaderboard:(limit=10) => api.get(`/citizens/leaderboard?limit=${limit}`),
  reportWaste:   (data)  => api.post('/citizens/report', data),
  getMyReports:  ()      => api.get('/citizens/my-reports'),
}

// ── RECYCLING ─────────────────────────────────────────────────────────────────
export const recyclingAPI = {
  getDashboard:        ()           => api.get('/recycling/dashboard'),
  getIntake:           (plantId)    => api.get(`/recycling/intake${plantId ? `?plant_id=${plantId}` : ''}`),
  recordIntake:        (data)       => api.post('/recycling/intake', data),
  updateIntakeStatus:  (id, status) => api.put(`/recycling/intake/${id}/status`, { processing_status: status }),
  getCapacity:         ()           => api.get('/recycling/capacity'),
  getBlockchainRecords:()           => api.get('/recycling/blockchain'),
  getReports:          (days=30)    => api.get(`/recycling/reports?days=${days}`),
  getPlants:           ()           => api.get('/recycling/plants'),
}

// ── BLOCKCHAIN ────────────────────────────────────────────────────────────────
export const blockchainAPI = {
  getTransactions: (limit=50, type) => api.get(`/blockchain/transactions?limit=${limit}${type ? `&tx_type=${type}` : ''}`),
  getStats:        ()               => api.get('/blockchain/stats'),
  getBinHistory:   (binId)          => api.get(`/blockchain/bin/${binId}`),
  getCitizenHistory:(userId)        => api.get(`/blockchain/citizen/${userId}`),
  verifyEvent:     (eventId)        => api.post(`/blockchain/verify/${eventId}`),
  getContract:     ()               => api.get('/blockchain/contract'),
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getMunicipality: () => api.get('/dashboard/municipality'),
  getCitizen:      () => api.get('/dashboard/citizen'),
  getRecycling:    () => api.get('/dashboard/recycling'),
  getPublic:       () => api.get('/dashboard/public'),
}

export default api
