import { useContext } from 'react'
import { AdminAuthContext } from './admin-auth-context.js'

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth debe utilizarse dentro de AdminAuthProvider')
  return context
}
