import { PageState } from './PageState.jsx'

export function QueryErrorState({ error, onRetry }) {
  const busy = error?.status === 429 || error?.status === 503
  const forbidden = error?.status === 403
  const title = forbidden
    ? 'No puedes consultar esta información'
    : busy ? 'El servicio está ocupado' : 'No pudimos cargar esta sección'
  const message = busy
    ? 'Espera un momento antes de intentarlo nuevamente.'
    : error?.code === 'NETWORK_ERROR'
      ? 'Revisa tu conexión e intenta nuevamente.'
      : 'La información no fue modificada. Puedes volver a intentarlo.'
  return (
    <PageState actionLabel="Reintentar" onAction={onRetry} title={title} variant={forbidden ? 'forbidden' : busy ? 'busy' : 'error'}>
      <p>{message}</p>
      {error?.correlationId && <p className="mt-2 text-xs">Referencia: {error.correlationId}</p>}
    </PageState>
  )
}
