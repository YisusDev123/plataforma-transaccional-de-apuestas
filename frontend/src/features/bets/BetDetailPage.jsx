import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { betsApi, betKeys } from './bets-api.js'
import { ButtonLink } from '../../shared/components/Button.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { DataTable } from '../../shared/components/DataTable.jsx'
import { DetailList } from '../../shared/components/DetailList.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { PlayerPage } from '../../shared/components/PlayerPage.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'
import { formatDate, formatDateTime, formatMoney } from '../../shared/utils/formatters.js'

export function BetDetailPage() {
  const { id } = useParams()
  const query = useQuery({ queryKey: betKeys.detail(id), queryFn: () => betsApi.detail(id), retry: false })
  const rows = (query.data?.items || []).map((item) => ({ id: item.id, draw: `${item.draw.lottery} · ${item.draw.modality}`, date: `${formatDate(item.draw.drawDate)} · ${item.draw.scheduleTime}`, number: <span className="text-lg font-black text-gold-400">{item.numberPlayed}</span>, amount: formatMoney(item.amount), multiplier: `×${item.multiplierSnapshot}`, potential: formatMoney(item.potentialPayout), payout: formatMoney(item.payoutAmount), status: <StatusBadge status={item.status} /> }))
  return <PlayerPage><PageHeader eyebrow="Ticket" title={query.data?.ticketCode || 'Detalle de apuesta'} actions={<><ButtonLink variant="secondary" to="/app/tickets"><ArrowLeft size={17} aria-hidden="true" /> Volver</ButtonLink>{query.data?.receiptAvailable && <ButtonLink to={`/app/tickets/${id}/comprobante`}><FileText size={17} aria-hidden="true" /> Ver comprobante</ButtonLink>}</>} />
    <section className="mt-7">{query.isPending ? <CardSkeleton /> : query.isError && query.error?.status === 404 ? <PageState title="Ticket no encontrado" actionLabel="Volver a tickets" actionTo="/app/tickets">El ticket no existe o no pertenece a tu cuenta.</PageState> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : <div className="grid gap-6"><DetailList items={[{ label: 'Código', value: query.data.ticketCode }, { label: 'Estado', value: <StatusBadge status={query.data.status} /> }, { label: 'Total apostado', value: formatMoney(query.data.totalAmount) }, { label: 'Fecha', value: formatDateTime(query.data.createdAt) }, { label: 'Cantidad de jugadas', value: query.data.items.length }]} /><div><h2 className="mb-4 text-xl font-black text-white">Jugadas</h2><DataTable caption="Jugadas del ticket" columns={[{ key: 'draw', label: 'Sorteo' }, { key: 'date', label: 'Fecha y hora' }, { key: 'number', label: 'Número' }, { key: 'amount', label: 'Monto' }, { key: 'multiplier', label: 'Multiplicador' }, { key: 'potential', label: 'Premio potencial' }, { key: 'payout', label: 'Premio pagado' }, { key: 'status', label: 'Estado' }]} rows={rows} /></div></div>}</section>
  </PlayerPage>
}
