import { Alert } from '../../shared/components/Alert.jsx'
import { SuccessFeedback } from '../../shared/components/SuccessFeedback.jsx'

export function AdminSuccess({ message }) {
  return <SuccessFeedback title="Acción completada" message={message} />
}

export function AdminError({ error }) {
  if (!error) return null
  const message = error.status === 409
    ? 'El registro cambió mientras lo revisabas. Actualizamos la información para evitar una acción duplicada.'
    : error.status === 403
      ? 'Tu rol o estado vigente no autoriza esta operación.'
      : error.status === 429 || error.status === 503
        ? 'El servicio está ocupado. Espera antes de volver a intentarlo.'
        : error.code === 'NETWORK_ERROR'
          ? 'No se confirmó ningún cambio. Revisa la conexión y vuelve a consultar el registro.'
          : error.message || 'No fue posible completar la operación.'
  return <Alert title="No pudimos completar la acción" variant="danger"><p>{message}</p>{error.correlationId && <p className="mt-2 text-xs">Referencia: {error.correlationId}</p>}</Alert>
}
