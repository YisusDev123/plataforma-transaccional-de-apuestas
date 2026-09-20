import { useQuery } from '@tanstack/react-query'
import { Eye, FileText } from 'lucide-react'
import { adminApi, adminKeys } from './admin-api.js'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { ButtonLink } from '../../shared/components/Button.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { DataTable } from '../../shared/components/DataTable.jsx'
import { HistoryFilters } from '../../shared/components/HistoryFilters.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { Pagination } from '../../shared/components/Pagination.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'
import { useHistorySearch } from '../../shared/hooks/useHistorySearch.js'
import { formatDateTime, formatMoney } from '../../shared/utils/formatters.js'

const statusOptions = [
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'WON', label: 'Ganadoras' },
  { value: 'LOST', label: 'Sin premio' },
  { value: 'REFUNDED', label: 'Reembolsadas' },
]

export function AdminBetsPage() {
  const { filters, setFilters } = useHistorySearch({ searchKey: 'ticketCode' })
  const query = useQuery({
    queryKey: adminKeys.bets(filters),
    queryFn: () => adminApi.bets(filters),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  })
  const rows = (query.data?.tickets || []).map((ticket) => ({
    id: ticket.id,
    ticket: <div><p className="font-black tracking-wide text-white">{ticket.ticketCode}</p><p className="text-xs text-muted">{ticket.customerName || 'Registro histórico'}</p></div>,
    amount: formatMoney(ticket.totalAmount),
    plays: ticket.itemCount,
    status: <StatusBadge status={ticket.status} />,
    date: formatDateTime(ticket.createdAt),
    actions: <div className="flex flex-wrap gap-2"><ButtonLink aria-label={`Ver apuesta ${ticket.ticketCode}`} className="min-h-9 px-3 py-1.5" variant="ghost" to={`/admin/apuestas/${ticket.id}`}><Eye size={16} aria-hidden="true" /> Detalle</ButtonLink>{ticket.receiptAvailable && <ButtonLink aria-label={`Ver comprobante ${ticket.ticketCode}`} className="min-h-9 px-3 py-1.5" variant="secondary" to={`/admin/apuestas/${ticket.id}/comprobante`}><FileText size={16} aria-hidden="true" /> PDF</ButtonLink>}</div>,
  }))

  return <AdminLayout>
    <PageHeader eyebrow="Operación" title="Apuestas entrantes" subtitle="Consulta las apuestas aceptadas. La lista se actualiza automáticamente y el código público permite localizar un ticket exacto." />
    <div className="mt-7"><HistoryFilters key={`${filters.status}:${filters.ticketCode}`} initialSearch={filters.ticketCode} searchName="ticketCode" searchLabel="Código del ticket" searchPlaceholder="Ejemplo: 6E6F55BA64DE" status={filters.status} statusOptions={statusOptions} onApply={(values) => setFilters({ ...values, page: 1 })} /></div>
    <section className="mt-5">{query.isPending ? <CardSkeleton /> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : rows.length === 0 ? <PageState title="No hay apuestas">No existen apuestas que coincidan con los filtros seleccionados.</PageState> : <><DataTable caption="Apuestas entrantes" columns={[{ key: 'ticket', label: 'Ticket y cliente' }, { key: 'amount', label: 'Total' }, { key: 'plays', label: 'Jugadas' }, { key: 'status', label: 'Estado' }, { key: 'date', label: 'Fecha' }, { key: 'actions', label: 'Acciones' }]} rows={rows} /><div className="mt-5"><Pagination currentPage={query.data.pagination.currentPage} totalPages={query.data.pagination.totalPages} onPageChange={(page) => setFilters({ page })} /></div></>}</section>
  </AdminLayout>
}
