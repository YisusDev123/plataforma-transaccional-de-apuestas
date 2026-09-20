import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpFromLine, CircleDollarSign } from 'lucide-react'
import { walletApi, walletKeys } from './wallet-api.js'
import { ButtonLink } from '../../shared/components/Button.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { DataTable } from '../../shared/components/DataTable.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { Pagination } from '../../shared/components/Pagination.jsx'
import { PlayerPage } from '../../shared/components/PlayerPage.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'
import { useHistorySearch } from '../../shared/hooks/useHistorySearch.js'
import { formatDateTime, formatMoney } from '../../shared/utils/formatters.js'
import { transactionTypeLabels } from '../../shared/utils/status.js'

export function WalletPage() {
  const { filters, setFilters } = useHistorySearch()
  const queryFilters = { page: filters.page, limit: filters.limit }
  const balance = useQuery({ queryKey: walletKeys.balance(), queryFn: walletApi.balance })
  const transactions = useQuery({ queryKey: walletKeys.transactions(queryFilters), queryFn: () => walletApi.transactions(queryFilters) })
  const rows = (transactions.data?.transacciones || []).map((item) => ({
    id: item.id,
    type: transactionTypeLabels[item.type] || item.type,
    amount: <span className="font-black text-white">{formatMoney(item.amount)}</span>,
    balance: formatMoney(item.balance_after),
    status: <StatusBadge status={item.status} />,
    date: formatDateTime(item.created_at),
  }))
  return (
    <PlayerPage>
      <PageHeader eyebrow="Finanzas" title="Billetera" subtitle="Consulta tus saldos y cada movimiento registrado por la plataforma." actions={<><ButtonLink to="/app/depositos/nuevo"><ArrowDownToLine size={17} aria-hidden="true" /> Depositar</ButtonLink><ButtonLink variant="secondary" to="/app/retiros/nuevo"><ArrowUpFromLine size={17} aria-hidden="true" /> Retirar</ButtonLink></>} />
      <section className="mt-7 grid gap-4 sm:grid-cols-2" aria-label="Saldos">
        {balance.isPending ? <><CardSkeleton /><CardSkeleton /></> : balance.isError ? <div className="sm:col-span-2"><QueryErrorState error={balance.error} onRetry={balance.refetch} /></div> : <><article className="surface-panel rounded-3xl p-6"><div className="flex items-center justify-between"><p className="text-sm font-bold text-muted">Disponible</p><CircleDollarSign className="text-jade-400" size={22} aria-hidden="true" /></div><p className="mt-4 text-4xl font-black text-white">{formatMoney(balance.data.available_balance)}</p></article><article className="surface-soft rounded-3xl p-6"><p className="text-sm font-bold text-muted">Retenido</p><p className="mt-4 text-4xl font-black text-white">{formatMoney(balance.data.held_balance)}</p><p className="mt-2 text-xs text-muted">Fondos asociados a retiros pendientes.</p></article></>}
      </section>
      <section className="mt-8"><h2 className="mb-4 text-xl font-black text-white">Historial de movimientos</h2>{transactions.isPending ? <div className="grid gap-3"><CardSkeleton /><CardSkeleton /></div> : transactions.isError ? <QueryErrorState error={transactions.error} onRetry={transactions.refetch} /> : rows.length === 0 ? <PageState title="Aún no tienes movimientos">Los débitos, créditos y fondos retenidos aparecerán aquí.</PageState> : <><DataTable caption="Movimientos de billetera" columns={[{ key: 'type', label: 'Movimiento' }, { key: 'amount', label: 'Monto' }, { key: 'balance', label: 'Saldo posterior' }, { key: 'status', label: 'Estado' }, { key: 'date', label: 'Fecha' }]} rows={rows} /><div className="mt-5"><Pagination currentPage={transactions.data.pagination.currentPage} totalPages={transactions.data.pagination.totalPages} onPageChange={(page) => setFilters({ page })} /></div></>}</section>
    </PlayerPage>
  )
}
