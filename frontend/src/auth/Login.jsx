import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'

const BuildingIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
)
const UserIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)
const RecycleIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)
const OrgIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const PORTALS = [
  { id: 'municipality_admin', label: 'Municipality',     Icon: BuildingIcon, desc: 'City authority portal',           accent: 'selected',        color: '#0ea5e9' },
  { id: 'citizen',            label: 'Citizen / Public', Icon: UserIcon,     desc: 'Public user portal',              accent: 'selected-green',  color: '#10b981' },
  { id: 'recycling_manager',  label: 'Recycling Plant',  Icon: RecycleIcon,  desc: 'Processing center portal',        accent: 'selected-gold',   color: '#f59e0b' },
  { id: 'government_agency',  label: 'Organization',     Icon: OrgIcon,      desc: 'Government, Private, Community',  accent: 'selected-purple', color: '#8b5cf6' },
]

export default function Login() {
  const { login } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [role,     setRole]     = useState('municipality_admin')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Please fill in all fields'); return }
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid-bg corner-glow flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="login-card w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-blue/10 border border-accent-blue/30 mb-4 animate-glow text-accent-blue">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-[0.25em] text-txt-primary glow-blue">SMART-WASTE</h1>
          <p className="text-xs font-semibold tracking-[0.2em] text-accent-blue mt-1">MUNICIPAL MANAGEMENT SYSTEM</p>
        </div>

        {/* Portal selector */}
        <div className="mb-6">
          <p className="section-title text-center mb-3">SELECT YOUR PORTAL</p>
          <div className="grid grid-cols-2 gap-2">
            {PORTALS.map((p) => {
              const isSelected = role === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setRole(p.id)}
                  className={`portal-card relative ${isSelected ? p.accent : ''}`}
                  style={isSelected ? { borderColor: p.color, boxShadow: `0 0 15px ${p.color}25` } : {}}
                >
                  {isSelected && (
                    <span className="absolute top-2 right-2 text-xs" style={{ color: p.color }}>✓</span>
                  )}
                  <div className="mb-1 flex justify-center" style={{ color: p.color }}><p.Icon /></div>
                  <div className="text-xs font-bold text-txt-primary">{p.label}</div>
                  <div className="text-[10px] text-txt-secondary mt-0.5">{p.desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="input-with-icon">
            <svg className="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <input
              type="email"
              className="input"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="input-with-icon">
            <svg className="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <input
              type={showPass ? 'text' : 'password'}
              className="input pr-12"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary hover:text-txt-primary transition-colors"
            >
              {showPass ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          <button type="submit" className="btn btn-primary w-full mt-2 h-12 text-sm tracking-widest" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
          </button>
        </form>

        <p className="text-center text-xs text-txt-secondary mt-6">
          Don't have access?{' '}
          <Link to="/register" className="text-accent-blue hover:text-sky-300 font-semibold transition-colors">
            Register here
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
