import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { adminAuthApi } from './admin-auth-api.js'
import { AdminAuthContext } from './admin-auth-context.js'
import { clearAccessToken, setAccessToken, subscribeToSessionInvalidation } from '../auth/session-store.js'

export function AdminAuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState({ status: 'loading', admin: null })

  const clearAdminSession = useCallback(() => {
    clearAccessToken('admin')
    setState({ status: 'unauthenticated', admin: null })
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] === 'admin' })
  }, [queryClient])

  useEffect(() => subscribeToSessionInvalidation(clearAdminSession, 'admin'), [clearAdminSession])

  useEffect(() => {
    let active = true
    adminAuthApi.profile().then((admin) => {
      if (active) setState({ status: 'authenticated', admin })
    }).catch(() => {
      if (active) clearAdminSession()
    })
    return () => { active = false }
  }, [clearAdminSession])

  const login = useCallback(async (credentials) => {
    const result = await adminAuthApi.login(credentials)
    setAccessToken(result.accessToken, 'admin')
    try {
      const admin = await adminAuthApi.profile(false)
      setState({ status: 'authenticated', admin })
      queryClient.setQueryData(['admin', 'session'], admin)
      return admin
    } catch (error) {
      clearAdminSession()
      throw error
    }
  }, [clearAdminSession, queryClient])

  const logout = useCallback(async () => {
    try {
      await adminAuthApi.logout()
    } finally {
      clearAdminSession()
    }
  }, [clearAdminSession])

  const refreshProfile = useCallback(async () => {
    const admin = await adminAuthApi.profile()
    setState({ status: 'authenticated', admin })
    queryClient.setQueryData(['admin', 'session'], admin)
    return admin
  }, [queryClient])

  useEffect(() => {
    if (state.status !== 'authenticated') return undefined
    const verify = () => refreshProfile().catch(clearAdminSession)
    const interval = window.setInterval(verify, 5 * 60_000)
    const onVisibility = () => { if (document.visibilityState === 'visible') verify() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility) }
  }, [clearAdminSession, refreshProfile, state.status])

  const value = useMemo(() => ({ ...state, login, logout, refreshProfile }), [login, logout, refreshProfile, state])
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
