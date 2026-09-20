import { useQuery } from '@tanstack/react-query'
import { BanknoteArrowDown, BanknoteArrowUp, FileCheck2, TicketCheck } from 'lucide-react'
import { adminApi, adminKeys } from './admin-api.js'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { Alert } from '../../shared/components/Alert.jsx'
import { ButtonLink } from '../../shared/components/Button.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'

const cards = [
  { key: 'pending_kyc', label: 'KYC pendientes', to: '/admin/kyc', icon: FileCheck2 },
  { key: 'pending_deposits', label: 'Depósitos pendientes', to: '/admin/depositos', icon: BanknoteArrowDown },
  { key: 'pending_withdrawals', label: 'Retiros pendientes', to: '/admin/retiros', icon: BanknoteArrowUp },
  { key: 'closed_draws', label: 'Resultados pendientes', to: '/admin/sorteos?status=CLOSED', icon: TicketCheck },
]

export function AdminDashboardPage() {
  const query = useQuery({ queryKey: adminKeys.summary(), queryFn: adminApi.summary, refetchInterval: 60_000 })
  return <AdminLayout>
    <PageHeader eyebrow="Operación interna" title="Resumen administrativo" subtitle="Revisa las colas que requieren intervención humana. Los valores se actualizan desde la API." />
    <section className="mt-7">{query.isPending ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></div> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : <>
      {query.data.system_status?.maintenance_mode && <Alert title="Sistema en mantenimiento" variant="warning"><p>{query.data.system_status.message || 'Las operaciones ordinarias están temporalmente restringidas.'}</p></Alert>}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map((card) => { const Icon = card.icon; return <article className="surface-soft rounded-2xl p-5" key={card.key}><div className="flex items-center justify-between"><Icon className="text-electric-400" size={21} aria-hidden="true" /><span className="text-3xl font-black">{query.data[card.key]}</span></div><p className="mt-4 text-sm font-bold text-muted">{card.label}</p><ButtonLink className="mt-4 min-h-9 px-3 py-1.5" variant="secondary" to={card.to}>Abrir cola</ButtonLink></article> })}</div>
      <Alert title={query.data.system_status?.sales_enabled ? 'Ventas habilitadas' : 'Ventas suspendidas'} variant={query.data.system_status?.sales_enabled ? 'success' : 'warning'}><p>Este indicador es informativo; cualquier cambio exige privilegios de `SUPER_ADMIN` en Reglas.</p></Alert>
    </>}</section>
  </AdminLayout>
}
