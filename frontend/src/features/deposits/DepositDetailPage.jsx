import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { depositsApi, depositKeys } from './deposits-api.js'
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

export function DepositDetailPage() {
  const { id } = useParams()
  const query = useQuery({ queryKey: depositKeys.detail(id), queryFn: () => depositsApi.detail(id), retry: false })
  return <PlayerPage><PageHeader eyebrow="Depósito" title="Detalle de solicitud" actions={<ButtonLink variant="secondary" to="/app/depositos"><ArrowLeft size={17} aria-hidden="true" /> Volver</ButtonLink>} />
    <section className="mt-7">{query.isPending ? <CardSkeleton /> : query.isError && query.error?.status === 404 ? <PageState title="Depósito no encontrado" actionLabel="Volver a depósitos" actionTo="/app/depositos">La solicitud no existe o no pertenece a tu cuenta.</PageState> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : <div className="grid gap-5"><DetailList items={[{ label: 'Monto', value: formatMoney(query.data.amount) }, { label: 'Estado', value: <StatusBadge status={query.data.status} /> }, { label: 'Referencia', value: query.data.referenceNumber }, { label: 'Método utilizado', value: query.data.destination ? query.data.destination.type === 'BANK_ACCOUNT' ? 'Cuenta bancaria' : 'SINPE Móvil' : 'No disponible (registro antiguo)' }, { label: 'Destino histórico', value: query.data.destination?.destinationValue || 'No disponible (registro antiguo)' }, { label: 'Titular', value: query.data.destination?.accountHolder || 'No disponible (registro antiguo)' }, { label: 'Request ID', value: query.data.requestId }, { label: 'Creado', value: formatDateTime(query.data.createdAt) }, { label: 'Revisado', value: formatDateTime(query.data.reviewedAt) }]} />{query.data.rejectionReason && <Alert title="Motivo del rechazo" variant="danger"><p>{query.data.rejectionReason}</p></Alert>}</div>}</section>
  </PlayerPage>
}
