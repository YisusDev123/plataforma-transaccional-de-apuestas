import { Alert } from './Alert.jsx'

export function SuccessFeedback({ message, title = 'Solicitud completada' }) {
  if (!message) return null
  return <Alert title={title} variant="success"><p>{message}</p></Alert>
}
