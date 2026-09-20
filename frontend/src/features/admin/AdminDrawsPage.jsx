import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Gauge, Trophy } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { adminApi, adminKeys } from './admin-api.js'
import { AdminError, AdminSuccess } from './AdminFeedback.jsx'
import { useAdminAuth } from '../admin-auth/useAdminAuth.js'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { Button, ButtonLink } from '../../shared/components/Button.jsx'
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
import { formatDate } from '../../shared/utils/formatters.js'

const statusOptions = ['PENDING', 'OPEN', 'CLOSED', 'RESULT_LOADED', 'PAID', 'CANCELLED'].map((value) => ({ value, label: value }))

export function AdminDrawsPage() {
  const { admin } = useAdminAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') || 'CLOSED'
  const page = Number(searchParams.get('page')) || 1
  const [action, setAction] = useState(null)
  const [winningNumber, setWinningNumber] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const queryClient = useQueryClient()
  const filters = { status, page, limit: 20 }
  const query = useQuery({ queryKey: adminKeys.draws(filters), queryFn: () => adminApi.draws(filters) })
  const mutation = useMutation({ mutationFn: () => action.type === 'result' ? adminApi.loadResults([{ draw_id: action.draw.draw_id, winning_number: Number(winningNumber) }]) : adminApi.cancelDraw(action.draw.draw_id), onSuccess: async () => { setSuccessMessage(action.type === 'result' ? 'Resultado guardado correctamente.' : 'Sorteo cancelado correctamente.'); setAction(null); setWinningNumber(''); await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin', 'draws'] }), queryClient.invalidateQueries({ queryKey: adminKeys.summary() })]) }, onError: () => query.refetch() })
  const confirm = () => { if (action.type === 'result' && !/^\d{1,2}$/.test(winningNumber)) return setFormError('Ingresa un número entre 00 y 99.'); setFormError(''); mutation.mutate() }
  const setFilters = (next) => setSearchParams({ status: next.status ?? status, page: String(next.page ?? page) })
  const rows = (query.data?.draws || []).map((draw) => ({ id: draw.draw_id, draw: <div><p className="font-bold text-white">{draw.lottery} · {draw.modality}</p><p className="text-xs text-muted">ID {draw.draw_id}</p></div>, schedule: `${formatDate(draw.draw_date)} · ${String(draw.schedule_time).slice(0, 5)}`, status: <StatusBadge status={draw.status} />, result: draw.result_number == null ? '—' : String(draw.result_number).padStart(2, '0'), actions: <div className="flex flex-wrap gap-2">{draw.status === 'CLOSED' && <Button className="min-h-9 px-3 py-1.5" variant="success" onClick={() => { setSuccessMessage(''); setAction({ type: 'result', draw }); setWinningNumber(''); mutation.reset() }}><Trophy size={15} aria-hidden="true" /> Resultado</Button>}{admin.role === 'SUPER_ADMIN' && ['PENDING', 'OPEN', 'CLOSED'].includes(draw.status) && <Button className="min-h-9 px-3 py-1.5" variant="danger" onClick={() => { setSuccessMessage(''); setAction({ type: 'cancel', draw }); mutation.reset() }}><Ban size={15} aria-hidden="true" /> Cancelar</Button>}{admin.role === 'SUPER_ADMIN' && <ButtonLink className="min-h-9 px-3 py-1.5" variant="secondary" to={`/admin/sorteos/${draw.draw_id}/limites`}><Gauge size={15} aria-hidden="true" /> Límites</ButtonLink>}</div> }))
  return <AdminLayout><PageHeader eyebrow="Sorteos automáticos" title="Sorteos y resultados" subtitle="Los jobs crean, abren, cierran y pagan. Aquí sólo se cargan resultados o se ejecutan cancelaciones extraordinarias autorizadas." actions={<div className="w-56"><SelectField label="Estado" options={statusOptions} value={status} onChange={(event) => setFilters({ status: event.target.value, page: 1 })} /></div>} /><div className="mt-6 grid gap-3"><AdminSuccess message={successMessage} /><AdminError error={mutation.error} /></div><section className="mt-6">{query.isPending ? <CardSkeleton /> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : rows.length === 0 ? <PageState title="No hay sorteos">No existen sorteos con este estado.</PageState> : <><DataTable caption="Sorteos administrativos" columns={[{ key: 'draw', label: 'Sorteo' }, { key: 'schedule', label: 'Fecha y hora' }, { key: 'status', label: 'Estado' }, { key: 'result', label: 'Resultado' }, { key: 'actions', label: 'Acciones' }]} rows={rows} /><div className="mt-5"><Pagination currentPage={query.data.pagination.currentPage} totalPages={query.data.pagination.totalPages} onPageChange={(nextPage) => setFilters({ page: nextPage })} /></div></>}</section><ConfirmDialog open={Boolean(action)} title={action?.type === 'result' ? 'Cargar resultado oficial' : 'Cancelar sorteo y reembolsar'} confirmLabel={action?.type === 'result' ? 'Guardar resultado' : 'Cancelar y reembolsar'} confirmLoading={mutation.isPending} onClose={() => setAction(null)} onConfirm={confirm}>{action?.type === 'result' ? <FormField label="Número ganador (00–99)" inputMode="numeric" value={winningNumber} onChange={(event) => setWinningNumber(event.target.value)} error={formError} maxLength={2} /> : <p>Esta operación cancela el sorteo y reembolsa completamente cada jugada activa dentro de una transacción. No puede deshacerse desde la interfaz.</p>}</ConfirmDialog></AdminLayout>
}
