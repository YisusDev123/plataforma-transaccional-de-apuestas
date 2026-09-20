import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
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
import { SelectField } from '../../shared/components/SelectField.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'
import { formatDateTime } from '../../shared/utils/formatters.js'

const options = [{ value: 'PENDING', label: 'Pendientes' }, { value: 'APPROVED', label: 'Aprobados' }, { value: 'REJECTED', label: 'Rechazados' }]

export function AdminKycPage() {
  const [status, setStatus] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [action, setAction] = useState(null)
  const [details, setDetails] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const queryClient = useQueryClient()
  const filters = { status, page, limit: 20 }
  const query = useQuery({ queryKey: adminKeys.kycs(filters), queryFn: () => adminApi.kycs(filters) })
  const mutation = useMutation({ mutationFn: () => adminApi.reviewKyc(action.item.id, action.status, details), onSuccess: async () => { setSuccessMessage(action.status === 'APPROVED' ? 'Identidad aprobada correctamente.' : 'Identidad rechazada correctamente.'); setAction(null); setDetails(''); await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin', 'kycs'] }), queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }), queryClient.invalidateQueries({ queryKey: adminKeys.summary() })]) }, onError: () => query.refetch() })
  const confirm = () => { if (!details.trim()) return setFormError('Los detalles son obligatorios para la auditoría.'); setFormError(''); mutation.mutate() }
  const rows = (query.data?.solicitudes || []).map((item) => ({ id: item.id, person: <div><p className="font-bold text-white">{item.full_name}</p><p className="text-xs text-muted">Usuario {item.user_id}</p></div>, document: item.dni, status: <StatusBadge status={item.kyc_status} />, created: formatDateTime(item.created_at), actions: item.kyc_status === 'PENDING' ? <div className="flex gap-2"><Button className="min-h-9 px-3 py-1.5" variant="success" onClick={() => { setSuccessMessage(''); setAction({ item, status: 'APPROVED' }); setDetails(''); mutation.reset() }}><Check size={15} aria-hidden="true" /> Aprobar</Button><Button className="min-h-9 px-3 py-1.5" variant="danger" onClick={() => { setSuccessMessage(''); setAction({ item, status: 'REJECTED' }); setDetails(''); mutation.reset() }}><X size={15} aria-hidden="true" /> Rechazar</Button></div> : 'Procesado' }))
  return <AdminLayout><PageHeader eyebrow="Identidad" title="Revisión KYC" subtitle="Comprueba identidad y registra siempre el criterio de revisión." actions={<div className="w-52"><SelectField label="Estado" options={options} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} /></div>} /><div className="mt-6 grid gap-3"><AdminSuccess message={successMessage} /><AdminError error={mutation.error} /></div><section className="mt-6">{query.isPending ? <CardSkeleton /> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : rows.length === 0 ? <PageState title="No hay solicitudes">No existen KYC con este estado.</PageState> : <><DataTable caption="Solicitudes KYC" columns={[{ key: 'person', label: 'Persona' }, { key: 'document', label: 'Documento' }, { key: 'status', label: 'Estado' }, { key: 'created', label: 'Enviado' }, { key: 'actions', label: 'Acción' }]} rows={rows} /><div className="mt-5"><Pagination currentPage={query.data.pagination.currentPage} totalPages={query.data.pagination.totalPages} onPageChange={setPage} /></div></>}</section><ConfirmDialog open={Boolean(action)} title={action?.status === 'APPROVED' ? 'Aprobar KYC' : 'Rechazar KYC'} confirmLabel={action?.status === 'APPROVED' ? 'Aprobar identidad' : 'Rechazar identidad'} confirmLoading={mutation.isPending} onClose={() => setAction(null)} onConfirm={confirm}><FormField label="Detalles para auditoría" value={details} onChange={(event) => setDetails(event.target.value)} error={formError} maxLength={500} /></ConfirmDialog></AdminLayout>
}
