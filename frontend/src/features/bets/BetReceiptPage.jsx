import { useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { betsApi } from './bets-api.js'
import { ButtonLink } from '../../shared/components/Button.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PlayerPage } from '../../shared/components/PlayerPage.jsx'
import { ReceiptViewer } from '../../shared/components/ReceiptViewer.jsx'

export function BetReceiptPage() {
  const { id } = useParams()
  const loadReceipt = useCallback(() => betsApi.receipt(id), [id])
  return <PlayerPage>
    <PageHeader eyebrow="Comprobante" title="Comprobante de apuesta" subtitle="Documento privado generado desde los datos inmutables de la apuesta aceptada." actions={<ButtonLink variant="secondary" to={`/app/tickets/${id}`}><ArrowLeft size={17} aria-hidden="true" /> Volver al ticket</ButtonLink>} />
    <div className="mt-7"><ReceiptViewer key={id} loadReceipt={loadReceipt} title="Comprobante PDF de la apuesta" /></div>
  </PlayerPage>
}
