import { Alert } from '../../../shared/components/Alert.jsx'
import { authErrorMessage } from '../auth-schemas.js'

export function AuthError({ error, fallback }) {
  if (!error) return null
  return <Alert title="No pudimos continuar" variant="danger"><p>{authErrorMessage(error, fallback)}</p>{error.correlationId && <p className="mt-2 text-xs">Referencia: {error.correlationId}</p>}</Alert>
}

export function AuthSuccess({ children, title = 'Solicitud completada' }) {
  return <Alert title={title} variant="success">{children}</Alert>
}
