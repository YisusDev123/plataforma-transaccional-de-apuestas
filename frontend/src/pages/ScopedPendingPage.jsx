import { AdminLayout } from '../shared/layouts/AdminLayout.jsx'
import { PlayerLayout } from '../shared/layouts/PlayerLayout.jsx'
import { PageState } from '../shared/components/PageState.jsx'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../features/auth/useAuth.js'

function PendingContent({ actionTo, description, title }) {
  return <PageState actionLabel="Volver al resumen" actionTo={actionTo} title={title}>{description}</PageState>
}

export function PlayerPendingPage({ description, title }) {
  const { logout, user } = useAuth()
  const mutation = useMutation({ mutationFn: logout })
  return <PlayerLayout user={user} onLogout={() => mutation.mutate()} logoutPending={mutation.isPending}><PendingContent actionTo="/app" description={description} title={title} /></PlayerLayout>
}

export function AdminPendingPage({ description, title }) {
  return <AdminLayout><PendingContent actionTo="/admin" description={description} title={title} /></AdminLayout>
}
