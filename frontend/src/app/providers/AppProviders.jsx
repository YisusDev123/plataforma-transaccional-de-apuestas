import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AuthProvider } from '../../features/auth/AuthContext.jsx'
import { AdminAuthProvider } from '../../features/admin-auth/AdminAuthContext.jsx'
import { PwaExperience } from '../../features/pwa/PwaExperience.jsx'
import { shouldRetryQuery } from '../../shared/api/query-options.js'

export function AppProviders({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryQuery, refetchOnWindowFocus: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
  }))

  return <QueryClientProvider client={queryClient}><AuthProvider><AdminAuthProvider>{children}<PwaExperience /></AdminAuthProvider></AuthProvider></QueryClientProvider>
}
