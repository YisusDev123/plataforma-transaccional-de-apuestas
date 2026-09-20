import { LoaderCircle } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from './useAdminAuth.js'
import { BrandMark } from '../../shared/components/BrandMark.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { safeAdminReturnTo } from './admin-navigation.js'
import { OfflineProtectedPage } from '../pwa/OfflineProtectedPage.jsx'
import { useOnlineStatus } from '../pwa/online-status.js'

export function AdminRoute({ children, roles }) {
  const { status, admin } = useAdminAuth()
  const location = useLocation()
  const online = useOnlineStatus()
  if (!online) return <OfflineProtectedPage scope="admin" />
  if (status === 'loading') return <main className="app-background grid min-h-screen place-items-center" role="status"><div className="text-center"><BrandMark /><LoaderCircle className="mx-auto mt-6 animate-spin text-electric-400" aria-hidden="true" /><span className="sr-only">Recuperando sesión administrativa</span></div></main>
  if (status !== 'authenticated') {
    const returnTo = `${location.pathname}${location.search}`
    return <Navigate replace to={`/admin/login?returnTo=${encodeURIComponent(returnTo)}`} />
  }
  if (roles && !roles.includes(admin.role)) return <main className="app-background grid min-h-screen place-items-center p-5"><PageState title="Acceso administrativo restringido" variant="forbidden">Tu rol vigente no permite utilizar esta sección.</PageState></main>
  return children
}

export function AdminPublicOnlyRoute({ children }) {
  const { status } = useAdminAuth()
  const location = useLocation()
  if (status === 'loading') return <main className="app-background grid min-h-screen place-items-center" role="status"><LoaderCircle className="animate-spin text-electric-400" aria-hidden="true" /><span className="sr-only">Comprobando sesión administrativa</span></main>
  if (status === 'authenticated') return <Navigate replace to={safeAdminReturnTo(new URLSearchParams(location.search).get('returnTo'))} />
  return children
}
