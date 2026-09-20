import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { adminApi, adminKeys } from './admin-api.js'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { ButtonLink } from '../../shared/components/Button.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { DataTable } from '../../shared/components/DataTable.jsx'
import { DetailList } from '../../shared/components/DetailList.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'
import { formatDate, formatDateTime, formatMoney } from '../../shared/utils/formatters.js'

export function AdminBetDetailPage() {
  const { id } = useParams()
  const query = useQuery({ queryKey: adminKeys.bet(id), queryFn: () => adminApi.bet(id), retry: false })
  const rows = (query.data?.items || []).map((item) => ({ id: item.id, draw: `${item.draw.lottery} · ${item.draw.modality}`, date: `${formatDate(item.draw.drawDate)} · ${item.draw.scheduleTime}`, number: <span className="text-lg font-black text-gold-400">{item.numberPlayed}</span>, amount: formatMoney(item.amount), multiplier: `×${item.multiplierSnapshot}`, potential: formatMoney(item.potentialPayout), payout: formatMoney(item.payoutAmount), status: <StatusBadge status={item.status} /> }))
  return <AdminLayout>
    <PageHeader eyebrow="Apuesta" title={query.data?.ticketCode || 'Detalle del ticket'} actions={<><ButtonLink variant="secondary" to="/admin/apuestas"><ArrowLeft size={17} aria-hidden="true" /> Volver</ButtonLink>{query.data?.receiptAvailable && <ButtonLink to={`/admin/apuestas/${id}/comprobante`}><FileText size={17} aria-hidden="true" /> Ver comprobante</ButtonLink>}</>} />
    <section className="mt-7">{query.isPending ? <CardSkeleton /> : query.isError && query.error?.status === 404 ? <PageState title="Apuesta no encontrada">El ticket solicitado no existe.</PageState> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : <div className="grid gap-6"><DetailList items={[{ label: 'Código', value: query.data.ticketCode }, { label: 'Cliente', value: query.data.customerName || 'No disponible en registro histórico' }, { label: 'Estado', value: <StatusBadge status={query.data.status} /> }, { label: 'Total apostado', value: formatMoney(query.data.totalAmount) }, { label: 'Fecha', value: formatDateTime(query.data.createdAt) }, { label: 'Cantidad de jugadas', value: query.data.items.length }]} /><div><h2 className="mb-4 text-xl font-black text-white">Jugadas</h2><DataTable caption="Jugadas administrativas del ticket" columns={[{ key: 'draw', label: 'Sorteo' }, { key: 'date', label: 'Fecha y hora' }, { key: 'number', label: 'Número' }, { key: 'amount', label: 'Monto' }, { key: 'multiplier', label: 'Multiplicador' }, { key: 'potential', label: 'Premio potencial' }, { key: 'payout', label: 'Premio pagado' }, { key: 'status', label: 'Estado' }]} rows={rows} /></div></div>}</section>
  </AdminLayout>
}
