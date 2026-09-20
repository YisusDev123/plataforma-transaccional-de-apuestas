import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from './auth-api.js'
import { clearAccessToken, setAccessToken, subscribeToSessionInvalidation } from './session-store.js'
import { AuthContext } from './auth-context.js'
import { clearFinancialIntents } from '../financial-intent/intent-store.js'

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState({ status: 'loading', user: null })

  const markUnauthenticated = useCallback(() => {
    clearAccessToken('user')
    clearFinancialIntents()
    setState({ status: 'unauthenticated', user: null })
    queryClient.clear()
  }, [queryClient])

  useEffect(() => subscribeToSessionInvalidation(markUnauthenticated, 'user'), [markUnauthenticated])

  useEffect(() => {
    let active = true
    authApi.getProfile().then((user) => {
      if (active) setState({ status: 'authenticated', user })
    }).catch(() => {
      if (active) markUnauthenticated()
    })
    return () => { active = false }
  }, [markUnauthenticated])

  const login = useCallback(async (credentials) => {
    const result = await authApi.login(credentials)
    setAccessToken(result.accessToken, 'user')
    try {
      const user = await authApi.getProfile(false)
      setState({ status: 'authenticated', user })
      queryClient.setQueryData(['user-session'], user)
      return user
    } catch (error) {
      markUnauthenticated()
      throw error
    }
  }, [markUnauthenticated, queryClient])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      markUnauthenticated()
    }
  }, [markUnauthenticated])

  const refreshProfile = useCallback(async () => {
    const user = await authApi.getProfile()
    setState({ status: 'authenticated', user })
    queryClient.setQueryData(['user-session'], user)
    return user
  }, [queryClient])

  const markKycPending = useCallback(() => {
    setState((current) => current.user
      ? { ...current, user: { ...current.user, kycStatus: 'PENDING' } }
      : current)
    queryClient.setQueryData(['user-session'], (current) => current
      ? { ...current, kycStatus: 'PENDING' }
      : current)
  }, [queryClient])

  const value = useMemo(() => ({ ...state, login, logout, refreshProfile, markKycPending }), [login, logout, markKycPending, refreshProfile, state])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
