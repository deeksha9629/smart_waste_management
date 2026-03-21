import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'

const PORTALS = [
  { id: 'municipality_admin', label: 'Municipality',    icon: '🏛️', desc: 'City authority',          accent: 'selected',        color: '#0ea5e9' },
  { id: 'citizen',            label: 'Citizen',         icon: '👤', desc: 'Public user',              accent: 'selected-green',  color: '#10b981' },
  { id: 'recycling_manager',  label: 'Recycling Plant', icon: '♻️', desc: 'Processing center',        accent: 'selected-gold',   color: '#f59e0b' },
  { id: 'government_agency',  label: 'Organization',    icon: '🏢', desc: 'Gov / Private / Community', accent: 'selected-purple', color: '#8b5cf6' },
]

const ORG_ROLES = ['municipality_admin', 'municipality_officer', 'recycling_manager', 'recycling_operator', 'government_agency', 'private_company']

export default function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '', confirm: '',
    role: 'citizen', organization_name: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.full_name || !form.email || !form.password) { toast.error('Please fill required fields'); return }
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await register({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        role: form.role,
        organization_name: form.organization_name || undefined,
      })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const showOrg = ORG_ROLES.includes(form.role)

  return (
    <div className="min-h-screen grid-bg corner-glow flex items-center justify-center p-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="login-card w-full"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-blue/10 border border-accent-blue/30 mb-3">
            <span className="text-2xl">♻️</span>
          </div>
          <h1 className="text-xl font-black tracking-[0.25em] text-txt-primary glow-blue">SMART-WASTE</h1>
          <p className="text-xs font-semibold tracking-[0.2em] text-accent-blue mt-1">CREATE ACCOUNT</p>
        </div>

        {/* Portal selector */}
        <div className="mb-5">
          <p className="section-title text-center mb-3">SELECT YOUR PORTAL</p>
          <div className="grid grid-cols-2 gap-2">
            {PORTALS.map((p) => {
              const isSelected = form.role === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, role: p.id }))}
                  className={`portal-card relative ${isSelected ? p.accent : ''}`}
                  style={isSelected ? { borderColor: p.color, boxShadow: `0 0 15px ${p.color}25` } : {}}
                >
                  {isSelected && <span className="absolute top-2 right-2 text-xs" style={{ color: p.color }}>✓</span>}
                  <div className="text-xl mb-1">{p.icon}</div>
                  <div className="text-xs font-bold text-txt-primary">{p.label}</div>
                  <div className="text-[10px] text-txt-secondary mt-0.5">{p.desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Full name */}
          <div className="input-with-icon">
            <svg className="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <input type="text" className="input" placeholder="Full name *" value={form.full_name} onChange={set('full_name')} />
          </div>

          {/* Email */}
          <div className="input-with-icon">
            <svg className="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <input type="email" className="input" placeholder="Email address *" value={form.email} onChange={set('email')} />
          </div>

          {/* Phone */}
          <div className="input-with-icon">
            <svg className="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <input type="tel" className="input" placeholder="Phone number" value={form.phone} onChange={set('phone')} />
          </div>

          {/* Organization (conditional) */}
          {showOrg && (
            <div className="input-with-icon">
              <svg className="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <input type="text" className="input" placeholder="Organization name" value={form.organization_name} onChange={set('organization_name')} />
            </div>
          )}

          {/* Password */}
          <div className="input-with-icon">
            <svg className="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <input
              type={showPass ? 'text' : 'password'}
              className="input pr-12"
              placeholder="Password * (min 8 chars)"
              value={form.password}
              onChange={set('password')}
            />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-secondary hover:text-txt-primary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>

          {/* Confirm password */}
          <div className="input-with-icon">
            <svg className="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <input
              type={showPass ? 'text' : 'password'}
              className="input"
              placeholder="Confirm password *"
              value={form.confirm}
              onChange={set('confirm')}
            />
          </div>

          <button type="submit" className="btn btn-primary w-full h-12 text-sm tracking-widest mt-2" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <p className="text-center text-xs text-txt-secondary mt-5">
          Already have access?{' '}
          <Link to="/login" className="text-accent-blue hover:text-sky-300 font-semibold transition-colors">
            Sign in here
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
