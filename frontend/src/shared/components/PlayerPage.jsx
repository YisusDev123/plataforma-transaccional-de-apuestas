import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../features/auth/useAuth.js'
import { PlayerLayout } from '../layouts/PlayerLayout.jsx'

export function PlayerPage({ children }) {
  const { logout, user } = useAuth()
  const logoutMutation = useMutation({ mutationFn: logout })
  return (
    <PlayerLayout user={user} onLogout={() => logoutMutation.mutate()} logoutPending={logoutMutation.isPending}>
      {children}
    </PlayerLayout>
  )
}
