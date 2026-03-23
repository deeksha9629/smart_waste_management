import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import RecyclingNavbar from '../../components/recycling/RecyclingNavbar'

export default function RecyclingLayout() {
  const { isAuthenticated, isRecycling, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isRecycling)     return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen grid-bg">
      <RecyclingNavbar />
      <main className="main-content flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
