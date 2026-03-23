import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import MunicipalNavbar from '../../components/municipality/MunicipalNavbar'

export default function MunicipalityLayout() {
  const { isAuthenticated, isMunicipality, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-center">
          <div className="spinner spinner-lg mx-auto mb-4" />
          <p className="text-txt-secondary text-sm tracking-widest">LOADING SYSTEM...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isMunicipality)  return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen grid-bg">
      <MunicipalNavbar />
      <main className="main-content flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
