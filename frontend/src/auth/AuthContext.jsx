import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authAPI } from '../services/api'
import { realtimeService } from '../services/realtimeService'

const AuthContext = createContext(null)

const MUNICIPALITY_ROLES = ['municipality_admin', 'municipality_officer']
const CITIZEN_ROLES      = ['citizen', 'community_group']
const RECYCLING_ROLES    = ['recycling_manager', 'recycling_operator']
const ORG_ROLES          = ['government_agency', 'private_company']

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)
  const [token,     setToken]     = useState(() => localStorage.getItem('sw_token'))
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  // Verify token on mount
  useEffect(() => {
    const verify = async () => {
      const stored = localStorage.getItem('sw_token')
      if (!stored) { setIsLoading(false); return }
      try {
        const res = await authAPI.getMe()
        if (res.data) {
          setUser(res.data)
          setToken(stored)
        } else {
          throw new Error('No user data')
        }
      } catch {
        // Try to restore from localStorage as fallback
        const cached = localStorage.getItem('sw_user')
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            setUser(parsed)
            setToken(stored)
          } catch {
            localStorage.removeItem('sw_token')
            localStorage.removeItem('sw_user')
            setToken(null)
            setUser(null)
          }
        } else {
          localStorage.removeItem('sw_token')
          localStorage.removeItem('sw_user')
          setToken(null)
          setUser(null)
        }
      } finally {
        setIsLoading(false)
      }
    }
    verify()
  }, [])

  const redirectByRole = useCallback((role) => {
    if (MUNICIPALITY_ROLES.includes(role) || ORG_ROLES.includes(role)) {
      navigate('/municipality/dashboard')
    } else if (CITIZEN_ROLES.includes(role)) {
      navigate('/citizen/home')
    } else if (RECYCLING_ROLES.includes(role)) {
      navigate('/recycling/dashboard')
    } else {
      navigate('/municipality/dashboard')
    }
  }, [navigate])

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login(email, password)
    const { access_token, user_role, user_id, full_name } = res.data
    localStorage.setItem('sw_token', access_token)
    const userData = { id: user_id, full_name, role: user_role, email }
    localStorage.setItem('sw_user', JSON.stringify(userData))
    setToken(access_token)
    setUser(userData)
    toast.success(`Welcome back, ${full_name}!`)
    redirectByRole(user_role)
    return res.data
  }, [redirectByRole])

  const register = useCallback(async (userData) => {
    const res = await authAPI.register(userData)
    toast.success('Account created! Please log in.')
    navigate('/login')
    return res.data
  }, [navigate])

  const logout = useCallback(async () => {
    // Clear local auth state first so logout feels instant and reliable.
    localStorage.removeItem('sw_token')
    localStorage.removeItem('sw_user')
    setToken(null)
    setUser(null)

    // Navigate immediately; do backend/session cleanup in the background.
    navigate('/login', { replace: true })
    toast.success('Logged out successfully')

    Promise.allSettled([
      authAPI.logout(),
      realtimeService.cleanup(),
    ]).catch(() => {})
  }, [navigate])

  const role = user?.role || null
  const isAuthenticated = !!token && !!user

  const isMunicipality = MUNICIPALITY_ROLES.includes(role) || ORG_ROLES.includes(role)
  const isCitizen      = CITIZEN_ROLES.includes(role)
  const isRecycling    = RECYCLING_ROLES.includes(role)

  return (
    <AuthContext.Provider value={{
      user, token, role, isAuthenticated, isLoading,
      isMunicipality, isCitizen, isRecycling,
      login, logout, register,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
