const statuses = {
  ACTIVE: { label: 'Activa', variant: 'success' },
  APPROVED: { label: 'Aprobado', variant: 'success' },
  CANCELLED: { label: 'Cancelado', variant: 'danger' },
  COMPLETED: { label: 'Completado', variant: 'success' },
  CONFIRMED: { label: 'Confirmado', variant: 'accent' },
  LOST: { label: 'Sin premio', variant: 'neutral' },
  NO_KYC: { label: 'Sin verificar', variant: 'neutral' },
  PENDING: { label: 'Pendiente', variant: 'warning' },
  REFUNDED: { label: 'Reembolsado', variant: 'accent' },
  REJECTED: { label: 'Rechazado', variant: 'danger' },
  SUSPENDED: { label: 'Suspendida', variant: 'danger' },
  UNVERIFIED: { label: 'Sin verificar', variant: 'neutral' },
  WON: { label: 'Ganador', variant: 'success' },
}

export function statusInfo(status) {
  const normalized = String(status || '').toUpperCase()
  return statuses[normalized] || { label: normalized || 'Sin estado', variant: 'neutral' }
}

export const transactionTypeLabels = {
  BET: 'Apuesta',
  BET_WIN: 'Premio',
  DEPOSIT: 'Depósito',
  REFUND: 'Reembolso',
  WITHDRAWAL: 'Retiro',
}
