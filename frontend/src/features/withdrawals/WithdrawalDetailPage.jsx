import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { withdrawalsApi, withdrawalKeys } from './withdrawals-api.js'
import { Alert } from '../../shared/components/Alert.jsx'
import { ButtonLink } from '../../shared/components/Button.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { DetailList } from '../../shared/components/DetailList.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { PlayerPage } from '../../shared/components/PlayerPage.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'
import { formatDateTime, formatMoney } from '../../shared/utils/formatters.js'

export function WithdrawalDetailPage() {
  const { id } = useParams()
  const query = useQuery({ queryKey: withdrawalKeys.detail(id), queryFn: () => withdrawalsApi.detail(id), retry: false })
  return <PlayerPage><PageHeader eyebrow="Retiro" title="Detalle de solicitud" actions={<ButtonLink variant="secondary" to="/app/retiros"><ArrowLeft size={17} aria-hidden="true" /> Volver</ButtonLink>} />
    <section className="mt-7">{query.isPending ? <CardSkeleton /> : query.isError && query.error?.status === 404 ? <PageState title="Retiro no encontrado" actionLabel="Volver a retiros" actionTo="/app/retiros">La solicitud no existe o no pertenece a tu cuenta.</PageState> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : <div className="grid gap-5"><DetailList items={[{ label: 'Monto', value: formatMoney(query.data.amount) }, { label: 'Estado', value: <StatusBadge status={query.data.status} /> }, { label: 'Cuenta destino o SINPE Móvil', value: query.data.destinationAccount }, { label: 'Nombre del titular', value: query.data.destinationAccountHolder || 'No disponible' }, { label: 'Creado', value: formatDateTime(query.data.createdAt) }, { label: 'Revisado', value: formatDateTime(query.data.reviewedAt) }, { label: 'Procesado', value: formatDateTime(query.data.processedAt) }]} />{query.data.rejectionReason && <Alert title="Motivo del rechazo" variant="danger"><p>{query.data.rejectionReason}</p></Alert>}</div>}</section>
  </PlayerPage>
}
