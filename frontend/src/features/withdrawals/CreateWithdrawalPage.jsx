import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { withdrawalsApi, withdrawalKeys } from './withdrawals-api.js'
import { useAuth } from '../auth/useAuth.js'
import { FinancialErrorAlert } from '../financial-intent/FinancialErrorAlert.jsx'
import { IntentRecoveryCard } from '../financial-intent/IntentRecoveryCard.jsx'
import { amountForApi, withdrawalFormSchema } from '../financial-intent/financial-schemas.js'
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
import { formatMoney, moneyToCents, subtractMoney } from '../../shared/utils/formatters.js'

const OPERATION = 'withdrawal'

function maskAccount(value) {
  const account = String(value || '')
  if (account.length <= 4) return '*'.repeat(account.length)
  return `${'*'.repeat(Math.min(8, account.length - 4))}${account.slice(-4)}`
}

export function CreateWithdrawalPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(withdrawalFormSchema), defaultValues: { amount: '', destinationAccount: '', destinationAccountHolder: '' } })
  const amount = useWatch({ control: form.control, name: 'amount' })
  const rules = useQuery({ queryKey: walletKeys.operationRules(), queryFn: walletApi.operationRules })
  const balance = useQuery({ queryKey: walletKeys.balance(), queryFn: walletApi.balance })
  const [confirmation, setConfirmation] = useState(null)
  const [intent, setIntent] = useState(() => getPendingIntent(OPERATION))
  const [uncertain, setUncertain] = useState(null)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [checkError, setCheckError] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const preparingRef = useRef(false)

  const createMutation = useMutation({
    mutationFn: ({ body }) => withdrawalsApi.create(body),
    onSuccess: async (result, variables) => {
      resolveIntent(OPERATION, variables.intent.requestId)
      setIntent(null)
      setUncertain(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: withdrawalKeys.all }),
        queryClient.invalidateQueries({ queryKey: walletKeys.all }),
      ])
      navigate(`/app/retiros/${result.id}`, { replace: true })
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
    mutationFn: () => withdrawalsApi.list({ page: 1, limit: 10, requestId: intent.requestId }),
    onSuccess: (result) => {
      const withdrawal = result.withdrawals[0]
      setCheckError(null)
      if (!withdrawal) return setNotFound(true)
      resolveIntent(OPERATION, intent.requestId)
      setIntent(null)
      queryClient.invalidateQueries({ queryKey: walletKeys.all })
      navigate(`/app/retiros/${withdrawal.id}`, { replace: true })
    },
    onError: (lookupError) => setCheckError(lookupError),
  })

  const openConfirmation = form.handleSubmit((values) => {
    if (moneyToCents(values.amount) < moneyToCents(rules.data.withdrawal.minimum)) {
      form.setError('amount', { message: `El retiro mínimo es ${formatMoney(rules.data.withdrawal.minimum)}.` })
      return
    }
    if (moneyToCents(values.amount) > moneyToCents(balance.data.available_balance)) {
      form.setError('amount', { message: 'El monto supera tu saldo disponible actual.' })
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
        body: { amount: amountForApi(values.amount), destinationAccount: values.destinationAccount, destinationAccountHolder: values.destinationAccountHolder, requestId: nextIntent.requestId },
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
  const estimated = subtractMoney(balance.data?.available_balance, amount)

  return <PlayerPage><PageHeader eyebrow="Retiros" title="Solicitar un retiro" subtitle="El monto aceptado pasará de saldo disponible a saldo retenido mientras se procesa manualmente." actions={<ButtonLink variant="secondary" to="/app/retiros"><ArrowLeft size={17} aria-hidden="true" /> Volver</ButtonLink>} />
    <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-5">
        {intent && <IntentRecoveryCard operationLabel="retiro" intent={intent} checking={checkMutation.isPending} checkError={checkError} notFound={notFound} canRetry={Boolean(uncertain)} onCheck={() => checkMutation.mutate()} onRetry={() => submit(uncertain.raw, uncertain.intent)} onAbandon={discard} />}
        <FinancialErrorAlert error={error} />
        {rules.isPending || balance.isPending ? <CardSkeleton /> : rules.isError ? <QueryErrorState error={rules.error} onRetry={rules.refetch} /> : balance.isError ? <QueryErrorState error={balance.error} onRetry={balance.refetch} /> : rules.data.withdrawal.requiresKyc && user.kycStatus !== 'APPROVED' ? <PageState variant="forbidden" title="Verifica tu identidad" actionLabel="Ir a verificación" actionTo="/app/perfil">Tus datos personales deben ser verificados para solicitar retiros.</PageState> : <form className="surface-panel grid gap-5 rounded-3xl p-5 sm:p-7" onSubmit={openConfirmation} noValidate><FormField inputMode="decimal" label="Monto a retirar" placeholder="5000.00" hint={`Disponible: ${formatMoney(balance.data.available_balance)} · Mínimo: ${formatMoney(rules.data.withdrawal.minimum)}`} error={form.formState.errors.amount?.message} {...form.register('amount')} /><FormField autoComplete="off" label="Cuenta destino o SINPE Móvil" hint="Ingresa el número de cuenta bancaria o teléfono asociado a SINPE Móvil." error={form.formState.errors.destinationAccount?.message} {...form.register('destinationAccount')} /><FormField autoComplete="name" label="Nombre del titular de la cuenta destino o SINPE Móvil" hint="Debe coincidir con el titular registrado en la cuenta o SINPE Móvil." error={form.formState.errors.destinationAccountHolder?.message} {...form.register('destinationAccountHolder')} />{estimated && <Alert title="Saldo resultante estimado"><p>{formatMoney(estimated)} disponibles después de aceptar la solicitud. El saldo se comprobará nuevamente al enviarla.</p></Alert>}<Button className="sm:justify-self-start" type="submit" disabled={Boolean(uncertain)}>Revisar retiro</Button></form>}
      </div>
      <aside><Alert title="Fondos protegidos" variant="warning"><p className="flex gap-2"><LockKeyhole className="mt-1 shrink-0" size={17} aria-hidden="true" /> Al confirmar, el monto queda retenido. Si el retiro es rechazado, el dinero será regresado a su billetera.</p></Alert></aside>
    </section>
    <ConfirmDialog open={Boolean(confirmation)} title="Confirma el retiro" confirmLabel="Confirmar retiro" confirmLoading={preparing || createMutation.isPending} onClose={() => setConfirmation(null)} onConfirm={() => submit()}><dl className="grid gap-3"><div><dt className="text-xs font-bold uppercase tracking-wider">Monto</dt><dd className="mt-1 text-lg font-black text-white">{formatMoney(confirmation?.amount)}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider">Cuenta destino o SINPE Móvil</dt><dd className="mt-1 font-semibold text-white">{maskAccount(confirmation?.destinationAccount)}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider">Nombre del titular</dt><dd className="mt-1 font-semibold text-white">{confirmation?.destinationAccountHolder}</dd></div></dl><p className="mt-4">El monto pasará inmediatamente a saldo retenido al aceptar la solicitud.</p></ConfirmDialog>
  </PlayerPage>
}
