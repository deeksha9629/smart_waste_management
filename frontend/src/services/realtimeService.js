/**
 * realtimeService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages two real-time channels:
 *
 *  1. Supabase Realtime  — subscribes to Postgres changes on `bins`, `alerts`,
 *                          `collection_events`, `recycling_intake` tables.
 *                          Fires instantly when Supabase writes to the DB.
 *
 *  2. FastAPI WebSocket  — connects to ws://localhost:8000/ws/live?token=JWT
 *                          Receives role-differentiated push data every 10 s.
 *
 * Usage:
 *   import { realtimeService } from './realtimeService'
 *
 *   // Subscribe to bin changes (Supabase Realtime)
 *   const unsub = realtimeService.onBinChange((payload) => { ... })
 *   unsub() // cleanup
 *
 *   // Connect WebSocket (FastAPI)
 *   realtimeService.connectWS(token, (msg) => { ... })
 *   realtimeService.disconnectWS()
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     || ''
const SUPABASE_ANON    = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const WS_BASE          = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
                           .replace(/^http/, 'ws')

// ── Supabase client (anon key — read-only realtime) ───────────────────────────
let _supabase = null
function getSupabase() {
  if (!_supabase && SUPABASE_URL && SUPABASE_ANON) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
  }
  return _supabase
}

// ── Listener registry ─────────────────────────────────────────────────────────
const _listeners = {
  bin:        new Set(),
  alert:      new Set(),
  collection: new Set(),
  intake:     new Set(),
  ws:         new Set(),
}

function _emit(channel, payload) {
  _listeners[channel].forEach((fn) => {
    try { fn(payload) } catch { /* ignore listener errors */ }
  })
}

function _subscribe(channel, fn) {
  _listeners[channel].add(fn)
  return () => _listeners[channel].delete(fn)
}

// ── Active Supabase channels ──────────────────────────────────────────────────
const _channels = {}

function _ensureChannel(table, listenerKey) {
  if (_channels[table]) return
  const sb = getSupabase()
  if (!sb) return // Supabase not configured — skip silently

  _channels[table] = sb
    .channel(`public:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      _emit(listenerKey, payload)
    })
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn(`[Realtime] channel error on table: ${table}`)
      }
    })
}

// ── WebSocket state ───────────────────────────────────────────────────────────
let _ws = null
let _wsReconnectTimer = null
let _wsToken = null
let _wsCallback = null
let _wsManualClose = false

function _connectWS(token, onMessage) {
  if (_ws && _ws.readyState === WebSocket.OPEN) return
  _wsToken    = token
  _wsCallback = onMessage
  _wsManualClose = false

  const url = `${WS_BASE}/ws/live?token=${token}`
  _ws = new WebSocket(url)

  _ws.onopen = () => {
    console.info('[WS] Connected to FastAPI WebSocket')
    clearTimeout(_wsReconnectTimer)
  }

  _ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      _emit('ws', msg)
      if (typeof _wsCallback === 'function') _wsCallback(msg)
    } catch { /* ignore malformed frames */ }
  }

  _ws.onerror = (err) => {
    console.warn('[WS] Error:', err)
  }

  _ws.onclose = (event) => {
    console.info('[WS] Closed — code:', event.code)
    if (!_wsManualClose && event.code !== 4001 && event.code !== 4003) {
      // Auto-reconnect after 5 s (skip auth failures)
      _wsReconnectTimer = setTimeout(() => {
        if (_wsToken) _connectWS(_wsToken, _wsCallback)
      }, 5000)
    }
  }
}

function _disconnectWS() {
  _wsManualClose = true
  clearTimeout(_wsReconnectTimer)
  if (_ws) {
    _ws.close()
    _ws = null
  }
}

function _sendWS(msg) {
  if (_ws && _ws.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify(msg))
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export const realtimeService = {
  /**
   * Subscribe to Supabase Realtime changes on the `bins` table.
   * Payload: { eventType, new, old, table }
   * Returns an unsubscribe function.
   */
  onBinChange(fn) {
    _ensureChannel('bins', 'bin')
    return _subscribe('bin', fn)
  },

  /**
   * Subscribe to new alerts from the `alerts` table.
   */
  onAlertChange(fn) {
    _ensureChannel('alerts', 'alert')
    return _subscribe('alert', fn)
  },

  /**
   * Subscribe to new collection events.
   */
  onCollectionChange(fn) {
    _ensureChannel('collection_events', 'collection')
    return _subscribe('collection', fn)
  },

  /**
   * Subscribe to recycling intake changes.
   */
  onIntakeChange(fn) {
    _ensureChannel('recycling_intake', 'intake')
    return _subscribe('intake', fn)
  },

  /**
   * Connect to the FastAPI WebSocket.
   * @param {string} token  JWT access token
   * @param {function} onMessage  Called with every parsed message object
   */
  connectWS(token, onMessage) {
    _connectWS(token, onMessage)
  },

  /**
   * Disconnect the FastAPI WebSocket (no auto-reconnect).
   */
  disconnectWS() {
    _disconnectWS()
  },

  /**
   * Subscribe to all FastAPI WebSocket messages.
   * Returns an unsubscribe function.
   */
  onWSMessage(fn) {
    return _subscribe('ws', fn)
  },

  /**
   * Send a message through the FastAPI WebSocket.
   * e.g. { type: 'ping' } or { type: 'request_update' }
   */
  sendWS(msg) {
    _sendWS(msg)
  },

  /**
   * Send a citizen location update to get nearby bins pushed back.
   */
  sendLocation(lat, lng, radiusKm = 2) {
    _sendWS({ type: 'location_update', lat, lng, radius_km: radiusKm })
  },

  /**
   * Tear down all Supabase channels and the WebSocket.
   * Call this on app unmount / logout.
   */
  async cleanup() {
    _disconnectWS()
    const sb = getSupabase()
    if (sb) {
      for (const ch of Object.values(_channels)) {
        await sb.removeChannel(ch).catch(() => {})
      }
    }
    Object.keys(_channels).forEach((k) => delete _channels[k])
    Object.keys(_listeners).forEach((k) => _listeners[k].clear())
  },

  /** Returns true if the WebSocket is currently open. */
  get isWSConnected() {
    return _ws?.readyState === WebSocket.OPEN
  },
}
