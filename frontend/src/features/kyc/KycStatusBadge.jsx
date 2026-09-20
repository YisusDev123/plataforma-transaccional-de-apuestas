import { Badge } from '../../shared/components/Badge.jsx'

const kycStatuses = {
  APPROVED: { label: 'Verificada', variant: 'success' },
  PENDING: { label: 'En revisión', variant: 'warning' },
  REJECTED: { label: 'No aprobada', variant: 'danger' },
  NO_KYC: { label: 'Sin verificar', variant: 'neutral' },
  UNVERIFIED: { label: 'Sin verificar', variant: 'neutral' },
}

export function KycStatusBadge({ status }) {
  const normalized = String(status || 'NO_KYC').toUpperCase()
  const info = kycStatuses[normalized] || kycStatuses.NO_KYC
  return <Badge variant={info.variant}>{info.label}</Badge>
}
