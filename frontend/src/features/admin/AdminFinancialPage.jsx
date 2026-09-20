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
import { formatDateTime, formatMoney } from '../../shared/utils/formatters.js'

const statusOptions = [{ value: 'PENDING', label: 'Pendientes' }, { value: 'APPROVED', label: 'Aprobados' }, { value: 'REJECTED', label: 'Rechazados' }]

function withdrawalSnapshot(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return { cuenta: value }
  }
}

export function AdminFinancialPage({ type }) {
  const deposit = type === 'deposit'
  const label = deposit ? 'Depósitos' : 'Retiros'
  const [status, setStatus] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [action, setAction] = useState(null)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const queryClient = useQueryClient()
  const filters = { status, page, limit: 20 }
  const key = deposit ? adminKeys.deposits(filters) : adminKeys.withdrawals(filters)
  const query = useQuery({ queryKey: key, queryFn: () => deposit ? adminApi.deposits(filters) : adminApi.withdrawals(filters) })
  const mutation = useMutation({
    mutationFn: () => {
      if (deposit) return action.type === 'approve' ? adminApi.approveDeposit(action.item.id) : adminApi.rejectDeposit(action.item.id, reason)
      return action.type === 'approve' ? adminApi.approveWithdrawal(action.item.withdrawal_id) : adminApi.rejectWithdrawal(action.item.withdrawal_id, reason)
    },
    onSuccess: async () => { setSuccessMessage(`${deposit ? 'Depósito' : 'Retiro'} ${action.type === 'approve' ? 'aprobado' : 'rechazado'} correctamente.`); setAction(null); setReason(''); await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin', deposit ? 'deposits' : 'withdrawals'] }), queryClient.invalidateQueries({ queryKey: adminKeys.summary() })]) },
    onError: () => query.refetch(),
  })
  const confirm = () => { if (action.type === 'reject' && reason.trim().length < 5) return setFormError('El motivo debe tener al menos 5 caracteres.'); setFormError(''); mutation.mutate() }
  const items = deposit ? query.data?.deposits || [] : query.data?.withdrawals || []
  const rows = items.map((item) => {
    const id = deposit ? item.id : item.withdrawal_id
    const destination = withdrawalSnapshot(item.withdrawal_account_snapshot)
    const depositDestination = item.destination_id ? { cuenta: item.destination_value, titular: item.account_holder, type: item.destination_type } : null
    return { id, account: <div><p className="font-bold text-white">{item.email}</p><p className="text-xs text-muted">{deposit ? item.full_name || `Usuario ${item.user_id}` : `Titular KYC: ${item.full_name || `Usuario ${item.user_id}`}`}</p></div>, reference: deposit ? item.reference_number : item.request_id, amount: <span className="font-black text-white">{formatMoney(item.amount)}</span>, destination: deposit ? <div className="min-w-44"><p className="font-bold text-white">{depositDestination ? `${depositDestination.type === 'BANK_ACCOUNT' ? 'Cuenta' : 'SINPE'}: ${depositDestination.cuenta}` : 'No disponible (registro antiguo)'}</p><p className="mt-1 text-xs text-muted">Titular: {depositDestination?.titular || 'No disponible'}</p></div> : <div className="min-w-44"><p className="font-bold text-white">{destination.cuenta || 'No disponible'}</p><p className="mt-1 text-xs text-muted">Titular indicado: {destination.titular || 'No disponible (registro antiguo)'}</p></div>, status: <StatusBadge status={item.status} />, created: formatDateTime(item.created_at), actions: item.status === 'PENDING' ? <div className="flex gap-2"><Button className="min-h-9 px-3 py-1.5" variant="success" onClick={() => { setSuccessMessage(''); setAction({ type: 'approve', item }); setReason(''); mutation.reset() }}><Check size={15} aria-hidden="true" /> Aprobar</Button><Button className="min-h-9 px-3 py-1.5" variant="danger" onClick={() => { setSuccessMessage(''); setAction({ type: 'reject', item }); setReason(''); mutation.reset() }}><X size={15} aria-hidden="true" /> Rechazar</Button></div> : 'Procesado' }
  })
  const columns = [{ key: 'account', label: 'Usuario' }, { key: 'reference', label: 'Referencia' }, { key: 'amount', label: 'Monto' }, { key: 'destination', label: 'Cuenta o SINPE Móvil' }, { key: 'status', label: 'Estado' }, { key: 'created', label: 'Fecha' }, { key: 'actions', label: 'Acción' }]
  return <AdminLayout><PageHeader eyebrow="Operación financiera" title={label} subtitle={`Procesa ${label.toLowerCase()} pendientes con confirmación explícita y sin cambios optimistas.`} actions={<div className="w-52"><SelectField label="Estado" options={statusOptions} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} /></div>} /><div className="mt-6 grid gap-3"><AdminSuccess message={successMessage} /><AdminError error={mutation.error} /></div><section className="mt-6">{query.isPending ? <CardSkeleton /> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : rows.length === 0 ? <PageState title={`No hay ${label.toLowerCase()}`}>No existen solicitudes con este estado.</PageState> : <><DataTable caption={label} columns={columns} rows={rows} /><div className="mt-5"><Pagination currentPage={query.data.pagination.currentPage} totalPages={query.data.pagination.totalPages} onPageChange={setPage} /></div></>}</section><ConfirmDialog open={Boolean(action)} title={`${action?.type === 'approve' ? 'Aprobar' : 'Rechazar'} ${deposit ? 'depósito' : 'retiro'}`} confirmLabel={action?.type === 'approve' ? 'Confirmar aprobación' : 'Confirmar rechazo'} confirmLoading={mutation.isPending} onClose={() => setAction(null)} onConfirm={confirm}>{action?.type === 'reject' ? <FormField label="Motivo obligatorio" value={reason} onChange={(event) => setReason(event.target.value)} error={formError} maxLength={255} /> : <p>La API volverá a comprobar que la solicitud siga pendiente antes de modificar dinero o saldos retenidos.</p>}</ConfirmDialog></AdminLayout>
}
