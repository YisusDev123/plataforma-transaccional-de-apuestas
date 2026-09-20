import { useQuery } from '@tanstack/react-query'
import { Eye, Plus } from 'lucide-react'
import { depositsApi, depositKeys } from './deposits-api.js'
import { ButtonLink } from '../../shared/components/Button.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { DataTable } from '../../shared/components/DataTable.jsx'
import { HistoryFilters } from '../../shared/components/HistoryFilters.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { Pagination } from '../../shared/components/Pagination.jsx'
import { PlayerPage } from '../../shared/components/PlayerPage.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'
import { useHistorySearch } from '../../shared/hooks/useHistorySearch.js'
import { formatDateTime, formatMoney } from '../../shared/utils/formatters.js'

const statusOptions = [{ value: 'PENDING', label: 'Pendientes' }, { value: 'APPROVED', label: 'Aprobados' }, { value: 'REJECTED', label: 'Rechazados' }]

export function DepositsPage() {
  const { filters, setFilters } = useHistorySearch()
  const query = useQuery({ queryKey: depositKeys.list(filters), queryFn: () => depositsApi.list(filters) })
  const rows = (query.data?.deposits || []).map((item) => ({ id: item.id, reference: item.referenceNumber, amount: <span className="font-black text-white">{formatMoney(item.amount)}</span>, status: <StatusBadge status={item.status} />, date: formatDateTime(item.createdAt), detail: <ButtonLink aria-label={`Ver depósito ${item.id}`} className="min-h-9 px-3 py-1.5" variant="ghost" to={`/app/depositos/${item.id}`}><Eye size={16} aria-hidden="true" /> Ver</ButtonLink> }))
  return <PlayerPage><PageHeader eyebrow="Finanzas" title="Depósitos" subtitle="Consulta las solicitudes registradas, sus referencias y el resultado de cada revisión." actions={<ButtonLink to="/app/depositos/nuevo"><Plus size={17} aria-hidden="true" /> Nuevo depósito</ButtonLink>} /><div className="mt-7"><HistoryFilters key={`${filters.status}:${filters.requestId}`} initialSearch={filters.requestId} status={filters.status} statusOptions={statusOptions} onApply={(values) => setFilters({ ...values, page: 1 })} /></div><section className="mt-5">{query.isPending ? <div className="grid gap-3"><CardSkeleton /><CardSkeleton /></div> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : rows.length === 0 ? <PageState title="No encontramos depósitos">No hay solicitudes que coincidan con los filtros seleccionados.</PageState> : <><DataTable caption="Historial de depósitos" columns={[{ key: 'reference', label: 'Referencia' }, { key: 'amount', label: 'Monto' }, { key: 'status', label: 'Estado' }, { key: 'date', label: 'Fecha' }, { key: 'detail', label: 'Detalle' }]} rows={rows} /><div className="mt-5"><Pagination currentPage={query.data.pagination.currentPage} totalPages={query.data.pagination.totalPages} onPageChange={(page) => setFilters({ page })} /></div></>}</section></PlayerPage>
}
