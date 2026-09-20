import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, CircleDollarSign, Play, ShieldCheck, Ticket } from 'lucide-react'
import { useAuth } from '../auth/useAuth.js'
import { KycStatusBadge } from '../kyc/KycStatusBadge.jsx'
import { walletApi, walletKeys } from '../wallet/wallet-api.js'
import { Alert } from '../../shared/components/Alert.jsx'
import { Badge } from '../../shared/components/Badge.jsx'
import { ButtonLink } from '../../shared/components/Button.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PlayerPage } from '../../shared/components/PlayerPage.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'
import { formatDateTime, formatMoney } from '../../shared/utils/formatters.js'
import { transactionTypeLabels } from '../../shared/utils/status.js'

const actions = [
  { icon: Play, label: 'Crear jugada', to: '/app/jugar', color: 'text-jade-400 bg-jade-400/10' },
  { icon: ArrowDownToLine, label: 'Depositar', to: '/app/depositos/nuevo', color: 'text-electric-400 bg-electric-500/15' },
  { icon: ArrowUpFromLine, label: 'Retirar', to: '/app/retiros/nuevo', color: 'text-gold-400 bg-gold-400/10' },
  { icon: Ticket, label: 'Mis tickets', to: '/app/tickets', color: 'text-coral-400 bg-coral-400/10' },
]

function BalanceSummary() {
  const balance = useQuery({ queryKey: walletKeys.balance(), queryFn: walletApi.balance })
  if (balance.isPending) return <><CardSkeleton /><CardSkeleton /></>
  if (balance.isError) return <div className="sm:col-span-2"><QueryErrorState error={balance.error} onRetry={balance.refetch} /></div>
  return (
    <>
      <article className="surface-panel rounded-3xl p-5 sm:col-span-2">
        <div className="flex items-center justify-between"><p className="text-sm font-bold text-muted">Saldo disponible</p><CircleDollarSign className="text-jade-400" size={22} aria-hidden="true" /></div>
        <p className="mt-4 text-4xl font-black tracking-tight text-white">{formatMoney(balance.data.available_balance)}</p>
        <p className="mt-2 text-xs text-muted">Disponible para jugar o solicitar un retiro.</p>
      </article>
      <article className="surface-soft rounded-3xl p-5 sm:col-span-2 xl:col-span-1">
        <p className="text-sm font-bold text-muted">Saldo retenido</p>
        <p className="mt-4 text-3xl font-black text-white">{formatMoney(balance.data.held_balance)}</p>
        <Badge variant={String(balance.data.held_balance) === '0.00' ? 'neutral' : 'warning'}>Retiros en proceso</Badge>
      </article>
    </>
  )
}

function RecentTransactions() {
  const filters = { page: 1, limit: 5 }
  const query = useQuery({ queryKey: walletKeys.transactions(filters), queryFn: () => walletApi.transactions(filters) })
  if (query.isPending) return <div className="grid gap-3"><CardSkeleton /><CardSkeleton /></div>
  if (query.isError) return <QueryErrorState error={query.error} onRetry={query.refetch} />
  if (!query.data.transacciones.length) return <Alert title="Aún no tienes movimientos"><p>Los débitos y créditos confirmados aparecerán aquí.</p></Alert>
  return (
    <div className="grid gap-2">
      {query.data.transacciones.map((transaction) => (
        <article className="surface-soft flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" key={transaction.id}>
          <div><p className="font-bold text-white">{transactionTypeLabels[transaction.type] || transaction.type}</p><p className="mt-1 text-xs text-muted">{formatDateTime(transaction.created_at)}</p></div>
          <div className="text-right"><p className="font-black text-white">{formatMoney(transaction.amount)}</p><StatusBadge status={transaction.status} /></div>
        </article>
      ))}
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const kycStatus = String(user.kycStatus || 'UNVERIFIED').toUpperCase()
  const kycApproved = kycStatus === 'APPROVED'
  const kycPending = kycStatus === 'PENDING'
  return (
    <PlayerPage>
      <PageHeader eyebrow="Área de jugador" title="Tu cuenta, al día" subtitle={`Hola, ${user.email}. Este resumen proviene directamente de la plataforma.`} actions={<ButtonLink to="/app/perfil">Ver perfil <ArrowRight size={17} aria-hidden="true" /></ButtonLink>} />
      <div className="mt-6"><Alert title={kycApproved ? 'Identidad verificada' : kycPending ? 'Verificación en revisión' : 'Completa tu verificación'} variant={kycApproved ? 'success' : 'warning'}><p className="flex items-center gap-2"><ShieldCheck size={17} aria-hidden="true" /> Estado de verificación: <KycStatusBadge status={kycStatus} /></p></Alert></div>
      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Resumen financiero"><BalanceSummary /></section>
      <section className="mt-7"><h2 className="text-lg font-black text-white">Acciones principales</h2><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{actions.map((action) => { const Icon = action.icon; return <ButtonLink className="surface-soft min-h-28 flex-col rounded-2xl px-4" variant="ghost" to={action.to} key={action.label}><span className={`grid size-10 place-items-center rounded-xl ${action.color}`}><Icon size={20} aria-hidden="true" /></span>{action.label}</ButtonLink> })}</div></section>
      <section className="mt-7"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-black text-white">Movimientos recientes</h2><ButtonLink variant="ghost" to="/app/billetera">Ver todos <ArrowRight size={16} aria-hidden="true" /></ButtonLink></div><RecentTransactions /></section>
    </PlayerPage>
  )
}
