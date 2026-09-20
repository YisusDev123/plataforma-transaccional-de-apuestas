import { LoaderCircle } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth.js'
import { BrandMark } from '../../shared/components/BrandMark.jsx'
import { safePlayerReturnTo } from './auth-navigation.js'
import { OfflineProtectedPage } from '../pwa/OfflineProtectedPage.jsx'
import { useOnlineStatus } from '../pwa/online-status.js'

function SessionLoader() {
  return (
    <main className="app-background grid min-h-screen place-items-center p-6" role="status">
      <div className="text-center"><BrandMark /><LoaderCircle className="mx-auto mt-7 animate-spin text-electric-400" size={28} aria-hidden="true" /><p className="mt-3 text-sm text-muted">Recuperando tu sesión…</p></div>
    </main>
  )
}

export function ProtectedRoute({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  const online = useOnlineStatus()
  if (!online) return <OfflineProtectedPage />
  if (status === 'loading') return <SessionLoader />
  if (status !== 'authenticated') {
    const returnTo = `${location.pathname}${location.search}`
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }
  return children
}

export function PublicOnlyRoute({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <SessionLoader />
  if (status === 'authenticated') {
    const returnTo = new URLSearchParams(location.search).get('returnTo')
    return <Navigate to={safePlayerReturnTo(returnTo)} replace />
  }
  return children
}
