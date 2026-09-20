import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { betsApi, betKeys } from './bets-api.js'
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

const statusOptions = [{ value: 'CONFIRMED', label: 'Confirmados' }, { value: 'WON', label: 'Ganadores' }, { value: 'LOST', label: 'Sin premio' }, { value: 'REFUNDED', label: 'Reembolsados' }]

export function BetsPage() {
  const { filters, setFilters } = useHistorySearch({ searchKey: 'ticketCode' })
  const query = useQuery({ queryKey: betKeys.list(filters), queryFn: () => betsApi.list(filters) })
  const rows = (query.data?.tickets || []).map((item) => ({ id: item.id, ticket: <span className="font-black tracking-wide text-white">{item.ticketCode}</span>, amount: formatMoney(item.totalAmount), plays: item.itemCount, result: item.status === 'WON' ? formatMoney(item.totalPayout) : item.status === 'REFUNDED' ? formatMoney(item.totalRefunded) : '—', status: <StatusBadge status={item.status} />, date: formatDateTime(item.createdAt), detail: <ButtonLink aria-label={`Ver ticket ${item.ticketCode}`} className="min-h-9 px-3 py-1.5" variant="ghost" to={`/app/tickets/${item.id}`}><Eye size={16} aria-hidden="true" /> Ver</ButtonLink> }))
  return <PlayerPage><PageHeader eyebrow="Apuestas" title="Mis tickets" subtitle="Consulta tus jugadas aceptadas, premios y reembolsos confirmados por la plataforma." /><div className="mt-7"><HistoryFilters key={`${filters.status}:${filters.ticketCode}`} initialSearch={filters.ticketCode} searchName="ticketCode" searchLabel="Código del ticket" searchPlaceholder="Ejemplo: 6E6F55BA64DE" status={filters.status} statusOptions={statusOptions} onApply={(values) => setFilters({ ...values, page: 1 })} /></div><section className="mt-5">{query.isPending ? <div className="grid gap-3"><CardSkeleton /><CardSkeleton /></div> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : rows.length === 0 ? <PageState title="No encontramos tickets">No hay apuestas que coincidan con los filtros seleccionados.</PageState> : <><DataTable caption="Historial de tickets" columns={[{ key: 'ticket', label: 'Ticket' }, { key: 'amount', label: 'Apostado' }, { key: 'plays', label: 'Jugadas' }, { key: 'result', label: 'Premio/Reembolso' }, { key: 'status', label: 'Estado' }, { key: 'date', label: 'Fecha' }, { key: 'detail', label: 'Detalle' }]} rows={rows} /><div className="mt-5"><Pagination currentPage={query.data.pagination.currentPage} totalPages={query.data.pagination.totalPages} onPageChange={(page) => setFilters({ page })} /></div></>}</section></PlayerPage>
}
