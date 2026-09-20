import { useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { adminApi } from './admin-api.js'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { ButtonLink } from '../../shared/components/Button.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { ReceiptViewer } from '../../shared/components/ReceiptViewer.jsx'

export function AdminBetReceiptPage() {
  const { id } = useParams()
  const loadReceipt = useCallback(() => adminApi.betReceipt(id), [id])
  return <AdminLayout>
    <PageHeader eyebrow="Comprobante" title="Comprobante de apuesta" subtitle="Documento privado generado desde el snapshot capturado al aceptar el ticket." actions={<ButtonLink variant="secondary" to={`/admin/apuestas/${id}`}><ArrowLeft size={17} aria-hidden="true" /> Volver al detalle</ButtonLink>} />
    <div className="mt-7"><ReceiptViewer key={id} loadReceipt={loadReceipt} title="Comprobante PDF administrativo de la apuesta" /></div>
  </AdminLayout>
}
