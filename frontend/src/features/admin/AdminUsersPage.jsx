import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, RotateCcw } from 'lucide-react'
import { adminApi, adminKeys } from './admin-api.js'
import { AdminError, AdminSuccess } from './AdminFeedback.jsx'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { Button } from '../../shared/components/Button.jsx'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.jsx'
import { DataTable } from '../../shared/components/DataTable.jsx'
import { FormField } from '../../shared/components/FormField.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { Pagination } from '../../shared/components/Pagination.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'
import { formatDateTime } from '../../shared/utils/formatters.js'

export function AdminUsersPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState(null)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const queryClient = useQueryClient()
  const filters = { page, limit: 20 }
  const query = useQuery({ queryKey: adminKeys.users(filters), queryFn: () => adminApi.users(filters) })
  const mutation = useMutation({
    mutationFn: () => action.type === 'suspend' ? adminApi.suspendUser(action.user.id, reason) : adminApi.reactivateUser(action.user.id),
    onSuccess: async () => { setSuccessMessage(action.type === 'suspend' ? 'Usuario suspendido correctamente.' : 'Usuario reactivado correctamente.'); setAction(null); setReason(''); await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }), queryClient.invalidateQueries({ queryKey: adminKeys.summary() })]) },
    onError: () => query.refetch(),
  })
  const confirm = () => {
    if (action.type === 'suspend' && reason.trim().length < 4) return setFormError('Explica el motivo con al menos 4 caracteres.')
    setFormError(''); mutation.mutate()
  }
  const users = query.data?.users || []
  const rows = users.map((user) => ({
    id: user.id,
    account: <div><p className="font-bold text-white">{user.email}</p><p className="text-xs text-muted">ID {user.id}</p></div>,
    status: <StatusBadge status={user.status} />,
    kyc: <StatusBadge status={user.kyc_status} />,
    created: formatDateTime(user.created_at),
    actions: user.status === 'ACTIVE' ? <Button className="min-h-9 px-3 py-1.5" variant="danger" onClick={() => { setSuccessMessage(''); setAction({ type: 'suspend', user }); setReason(''); mutation.reset() }}><Ban size={15} aria-hidden="true" /> Suspender</Button> : <Button className="min-h-9 px-3 py-1.5" variant="secondary" onClick={() => { setSuccessMessage(''); setAction({ type: 'reactivate', user }); mutation.reset() }}><RotateCcw size={15} aria-hidden="true" /> Reactivar</Button>,
  }))
  return <AdminLayout><PageHeader eyebrow="Control de acceso" title="Usuarios" subtitle="Consulta el estado vigente y revoca sesiones al suspender una cuenta." /><div className="mt-6 grid gap-3"><AdminSuccess message={successMessage} /><AdminError error={mutation.error} /></div><section className="mt-6">{query.isPending ? <CardSkeleton /> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : rows.length === 0 ? <PageState title="No hay usuarios">La colección está vacía.</PageState> : <><DataTable caption="Usuarios registrados" columns={[{ key: 'account', label: 'Cuenta' }, { key: 'status', label: 'Estado' }, { key: 'kyc', label: 'KYC' }, { key: 'created', label: 'Registro' }, { key: 'actions', label: 'Acción' }]} rows={rows} /><div className="mt-5"><Pagination currentPage={query.data.pagination.currentPage} totalPages={query.data.pagination.totalPages} onPageChange={setPage} /></div></>}</section>
    <ConfirmDialog open={Boolean(action)} title={action?.type === 'suspend' ? 'Suspender usuario' : 'Reactivar usuario'} confirmLabel={action?.type === 'suspend' ? 'Suspender cuenta' : 'Reactivar cuenta'} confirmLoading={mutation.isPending} onClose={() => setAction(null)} onConfirm={confirm}>{action?.type === 'suspend' ? <FormField label="Motivo obligatorio" value={reason} onChange={(event) => setReason(event.target.value)} error={formError} maxLength={500} /> : <p>La cuenta recuperará acceso con su estado KYC vigente.</p>}</ConfirmDialog>
  </AdminLayout>
}
