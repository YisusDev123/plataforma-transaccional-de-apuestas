import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Landmark, ShieldCheck, Smartphone } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { depositsApi, depositKeys } from './deposits-api.js'
import { useAuth } from '../auth/useAuth.js'
import { FinancialErrorAlert } from '../financial-intent/FinancialErrorAlert.jsx'
import { IntentRecoveryCard } from '../financial-intent/IntentRecoveryCard.jsx'
import { amountForApi, depositFormSchema } from '../financial-intent/financial-schemas.js'
import { isUncertainFinancialError } from '../financial-intent/financial-request.js'
import { abandonIntent, getPendingIntent, prepareIntent, resolveIntent } from '../financial-intent/intent-store.js'
import { walletApi, walletKeys } from '../wallet/wallet-api.js'
import { Alert } from '../../shared/components/Alert.jsx'
import { Button, ButtonLink } from '../../shared/components/Button.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.jsx'
import { FormField } from '../../shared/components/FormField.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { PlayerPage } from '../../shared/components/PlayerPage.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { formatMoney, moneyToCents } from '../../shared/utils/formatters.js'

const OPERATION = 'deposit'

export function CreateDepositPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(depositFormSchema), defaultValues: { amount: '', referenceNumber: '', destinationId: '' } })
  const rules = useQuery({ queryKey: walletKeys.operationRules(), queryFn: walletApi.operationRules })
  const [confirmation, setConfirmation] = useState(null)
  const [intent, setIntent] = useState(() => getPendingIntent(OPERATION))
  const [uncertain, setUncertain] = useState(null)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [checkError, setCheckError] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const preparingRef = useRef(false)

  const createMutation = useMutation({
    mutationFn: ({ body }) => depositsApi.create(body),
    onSuccess: async (result, variables) => {
      resolveIntent(OPERATION, variables.intent.requestId)
      setIntent(null)
      setUncertain(null)
      await queryClient.invalidateQueries({ queryKey: depositKeys.all })
      navigate(`/app/depositos/${result.id}`, { replace: true })
    },
    onError: (mutationError, variables) => {
      const conflictNeedsLookup = mutationError?.code === 'IDEMPOTENCY_KEY_CONFLICT' || mutationError?.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH'
      if (isUncertainFinancialError(mutationError) || conflictNeedsLookup) {
        setUncertain({ ...variables, error: mutationError })
      } else {
        resolveIntent(OPERATION, variables.intent.requestId)
        setIntent(null)
        setUncertain(null)
        setError(mutationError)
      }
      setConfirmation(null)
    },
    onSettled: () => {
      preparingRef.current = false
      setPreparing(false)
    },
  })

  const checkMutation = useMutation({
    mutationFn: () => depositsApi.list({ page: 1, limit: 10, requestId: intent.requestId }),
    onSuccess: (result) => {
      const deposit = result.deposits[0]
      setCheckError(null)
      if (!deposit) return setNotFound(true)
      resolveIntent(OPERATION, intent.requestId)
      setIntent(null)
      navigate(`/app/depositos/${deposit.id}`, { replace: true })
    },
    onError: (lookupError) => setCheckError(lookupError),
  })

  const openConfirmation = form.handleSubmit((values) => {
    if (moneyToCents(values.amount) < moneyToCents(rules.data.deposit.minimum)) {
      form.setError('amount', { message: `El depósito mínimo es ${formatMoney(rules.data.deposit.minimum)}.` })
      return
    }
    setError(null)
    setConfirmation(values)
  })

  const submit = async (values = confirmation, existingIntent = null) => {
    if (!values || preparingRef.current || createMutation.isPending) return
    preparingRef.current = true
    setPreparing(true)
    try {
      const nextIntent = existingIntent || await prepareIntent(OPERATION, values)
      setIntent(nextIntent)
      setNotFound(false)
      createMutation.mutate({
        body: { amount: amountForApi(values.amount), referenceNumber: values.referenceNumber, destinationId: values.destinationId, requestId: nextIntent.requestId },
        raw: values,
        intent: nextIntent,
      })
    } catch (intentError) {
      preparingRef.current = false
      setPreparing(false)
      setConfirmation(null)
      setIntent(getPendingIntent(OPERATION))
      setError(intentError)
    }
  }

  const discard = () => {
    abandonIntent(OPERATION)
    setIntent(null)
    setUncertain(null)
    setNotFound(false)
    setError(null)
  }

  const destinations = rules.data?.deposit?.destinations || []
  const confirmedDestination = destinations.find((destination) => destination.id === confirmation?.destinationId)

  return <PlayerPage><PageHeader eyebrow="Depósitos" title="Registrar un depósito" subtitle="Transfiere a uno de los destinos publicados y registra la referencia. El saldo se acreditará después de la aprobación administrativa." actions={<ButtonLink variant="secondary" to="/app/depositos"><ArrowLeft size={17} aria-hidden="true" /> Volver</ButtonLink>} />
    <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-5">
        {intent && <IntentRecoveryCard operationLabel="depósito" intent={intent} checking={checkMutation.isPending} checkError={checkError} notFound={notFound} canRetry={Boolean(uncertain)} onCheck={() => checkMutation.mutate()} onRetry={() => submit(uncertain.raw, uncertain.intent)} onAbandon={discard} />}
        <FinancialErrorAlert error={error} />
        {rules.isPending ? <CardSkeleton /> : rules.isError ? <QueryErrorState error={rules.error} onRetry={rules.refetch} /> : rules.data.deposit.requiresKyc && user.kycStatus !== 'APPROVED' ? <PageState variant="forbidden" title="Verifica tu identidad" actionLabel="Ir a verificación" actionTo="/app/perfil">Tus datos personales deben ser verificados para solicitar depósitos.</PageState> : destinations.length === 0 ? <PageState title="Depósitos temporalmente no disponibles">Aún no existe una cuenta bancaria o SINPE Móvil configurado. Intenta nuevamente más tarde.</PageState> : <form className="surface-panel grid gap-5 rounded-3xl p-5 sm:p-7" onSubmit={openConfirmation} noValidate>
          <fieldset className="grid gap-3"><legend className="text-sm font-bold text-[#e8eaf6]">¿A cuál destino realizaste la transferencia?</legend><div className="grid gap-3 sm:grid-cols-2">{destinations.map((destination) => { const Icon = destination.type === 'BANK_ACCOUNT' ? Landmark : Smartphone; return <label key={destination.id} className="flex cursor-pointer gap-3 rounded-2xl border border-white/12 bg-night-950/50 p-4 transition has-checked:border-electric-400 has-checked:bg-electric-500/10"><input className="mt-1 size-4 accent-[#8b5cf6]" type="radio" value={destination.id} {...form.register('destinationId', { valueAsNumber: true })} /><Icon className="mt-0.5 shrink-0 text-electric-400" size={20} aria-hidden="true" /><span className="min-w-0"><strong className="block text-white">{destination.type === 'BANK_ACCOUNT' ? 'Cuenta bancaria' : 'SINPE Móvil'}</strong><span className="mt-1 block break-all text-sm text-[#d8dbea]">{destination.destinationValue}</span><span className="mt-1 block text-xs text-muted">Titular: {destination.accountHolder}</span></span></label> })}</div>{form.formState.errors.destinationId && <p className="text-xs text-[#ff9ba5]">{form.formState.errors.destinationId.message}</p>}</fieldset>
          <FormField inputMode="decimal" label="Monto transferido" placeholder="5000.00" hint={`Mínimo vigente: ${formatMoney(rules.data.deposit.minimum)}`} error={form.formState.errors.amount?.message} {...form.register('amount')} />
          <FormField autoComplete="off" label="Número de referencia" hint="Utiliza exactamente la referencia del comprobante de transferencia." error={form.formState.errors.referenceNumber?.message} {...form.register('referenceNumber')} />
          <Button className="sm:justify-self-start" type="submit" disabled={Boolean(uncertain)}>Revisar depósito</Button>
        </form>}
      </div>
      <aside><Alert title="Acreditación manual"><p className="flex gap-2"><ShieldCheck className="mt-1 shrink-0" size={17} aria-hidden="true" /> Registrar la solicitud no cambia tu saldo. Un administrador comprobará la referencia antes de acreditarlo.</p></Alert></aside>
    </section>
    <ConfirmDialog open={Boolean(confirmation)} title="Confirma el depósito" confirmLabel="Confirmar depósito" confirmLoading={preparing || createMutation.isPending} onClose={() => setConfirmation(null)} onConfirm={() => submit()}><dl className="grid gap-3"><div><dt className="text-xs font-bold uppercase tracking-wider">Destino utilizado</dt><dd className="mt-1 break-all font-semibold text-white">{confirmedDestination?.type === 'BANK_ACCOUNT' ? 'Cuenta bancaria' : 'SINPE Móvil'} · {confirmedDestination?.destinationValue}</dd><dd className="mt-1 text-sm text-muted">Titular: {confirmedDestination?.accountHolder}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider">Monto</dt><dd className="mt-1 text-lg font-black text-white">{formatMoney(confirmation?.amount)}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider">Referencia</dt><dd className="mt-1 break-all font-semibold text-white">{confirmation?.referenceNumber}</dd></div></dl><p className="mt-4">La solicitud quedará pendiente de revisión y no acreditará saldo inmediatamente.</p></ConfirmDialog>
  </PlayerPage>
}
