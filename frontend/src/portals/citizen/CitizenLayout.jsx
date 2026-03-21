import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import CitizenNavbar from '../../components/citizen/CitizenNavbar'

export default function CitizenLayout() {
  const { isAuthenticated, isCitizen, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isCitizen)       return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen grid-bg">
      <CitizenNavbar />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
