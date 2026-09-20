import { Badge } from './Badge.jsx'
import { statusInfo } from '../utils/status.js'

export function StatusBadge({ status }) {
  const info = statusInfo(status)
  return <Badge variant={info.variant}>{info.label}</Badge>
}
