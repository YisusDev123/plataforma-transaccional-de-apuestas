import { Alert } from '../../shared/components/Alert.jsx'
import { ButtonLink } from '../../shared/components/Button.jsx'

function messageFor(error) {
  if (error?.code === 'PENDING_INTENT_PAYLOAD_MISMATCH') return 'Existe una solicitud anterior sin resolver con datos diferentes. Comprueba su estado antes de crear otra.'
  if (error?.code === 'REFERENCE_ALREADY_USED') return 'Ese número de referencia ya fue utilizado. Comprueba el depósito anterior o utiliza una referencia nueva.'
  if (error?.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') return 'El identificador de esta solicitud ya está asociado a datos diferentes. No la reenvíes.'
  if (error?.code === 'IDEMPOTENCY_KEY_CONFLICT') return 'El identificador de la solicitud ya está en uso. Comprueba el historial antes de continuar.'
  if (error?.code === 'KYC_REQUIRED') return 'Necesitas completar la verificación de identidad antes de confirmar una apuesta.'
  if (error?.code === 'INSUFFICIENT_FUNDS') return 'Tu saldo disponible no alcanza para confirmar este boleto.'
  if (error?.code === 'DRAW_CLOSED' || error?.code === 'DRAW_UNAVAILABLE') return 'Uno de los sorteos cerró o dejó de estar disponible. Actualiza el boleto antes de continuar.'
  if (error?.code === 'DRAW_OR_NUMBER_UNAVAILABLE') return 'Uno de los números seleccionados ya no está disponible.'
  if (error?.code === 'NUMBER_LIMIT_EXCEEDED') return 'La disponibilidad de uno de los números cambió. Reduce el monto o selecciona otro número.'
  if (error?.code === 'MIN_BET_NOT_MET') return 'Una jugada no alcanza el monto mínimo vigente.'
  if (error?.code === 'MAX_TICKET_TOTAL_EXCEEDED') return 'El boleto supera el máximo total vigente.'
  if (error?.code === 'SALES_DISABLED') return 'La venta de apuestas está temporalmente suspendida. Conserva tu boleto y vuelve más tarde.'
  if (error?.status === 429) return 'Has realizado demasiadas solicitudes. Espera antes de volver a intentarlo.'
  if (error?.status === 403) return 'Tu cuenta no cumple actualmente los requisitos para esta operación.'
  if (error?.status >= 500) return 'Ocurrió un problema inesperado. No crees otra solicitud hasta comprobar el historial.'
  return error?.message || 'No fue posible completar la solicitud.'
}

export function FinancialErrorAlert({ error }) {
  if (!error) return null
  return <Alert title="No pudimos completar la solicitud" variant="danger"><p>{messageFor(error)}</p>{error.status === 403 && <ButtonLink className="mt-3" variant="secondary" to="/app/perfil">Revisar verificación</ButtonLink>}{error.correlationId && <p className="mt-2 text-xs">Referencia: {error.correlationId}</p>}</Alert>
}
