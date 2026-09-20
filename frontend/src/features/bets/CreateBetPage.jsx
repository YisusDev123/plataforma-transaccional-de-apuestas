import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CircleDollarSign, Clock3, RefreshCw, ShieldCheck, ShoppingCart, Trash2, Trophy } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { betsApi, betKeys } from './bets-api.js'
import { calculatePotentialPayout, canonicalBetPayload, centsToMoney, ticketTotalCents, validateTicket } from './bet-builder.js'
import { drawsApi, drawKeys } from '../draws/draws-api.js'
import { useAuth } from '../auth/useAuth.js'
import { FinancialErrorAlert } from '../financial-intent/FinancialErrorAlert.jsx'
import { IntentRecoveryCard } from '../financial-intent/IntentRecoveryCard.jsx'
import { isUncertainFinancialError } from '../financial-intent/financial-request.js'
import { abandonIntent, getPendingIntent, prepareIntent, resolveIntent } from '../financial-intent/intent-store.js'
import { walletApi, walletKeys } from '../wallet/wallet-api.js'
import { Alert } from '../../shared/components/Alert.jsx'
import { Badge } from '../../shared/components/Badge.jsx'
import { Button, ButtonLink } from '../../shared/components/Button.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { PlayerPage } from '../../shared/components/PlayerPage.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { formatDate, formatDateTime, formatMoney, moneyToCents } from '../../shared/utils/formatters.js'

const OPERATION = 'bet'
const DRAFT_KEY = ['bet-draft']

function availabilityMap(results) {
  return new Map(results.flatMap((result) => result.numbers.map((number) => [
    `${result.draw.draw_id}:${number.number}`,
    number,
  ])))
}

function DrawCard({ active, draw, onSelect }) {
  return (
    <button className={`w-full min-w-0 rounded-2xl border p-4 text-left transition ${active ? 'border-electric-400 bg-electric-500/15 shadow-lg shadow-electric-500/10' : 'border-white/10 bg-white/[0.045] hover:border-white/25 hover:bg-white/[0.075]'}`} type="button" onClick={onSelect} aria-pressed={active}>
      <span className="flex items-start justify-between gap-3"><span><span className="block text-xs font-black uppercase tracking-[0.18em] text-gold-400">{draw.lottery}</span><span className="mt-1 block text-lg font-black text-white">{draw.modality}</span></span>{active && <Check className="text-jade-400" size={20} aria-hidden="true" />}</span>
      <span className="mt-3 block text-sm text-[#d7daea]">{formatDate(draw.draw_date)} · {draw.schedule_time}</span>
      <span className="mt-1 flex items-center gap-1.5 text-xs text-muted"><Clock3 size={14} aria-hidden="true" /> Cierra {formatDateTime(draw.close_at)}</span>
      <span className="mt-2 block text-sm font-black text-jade-400">Premio ×{draw.payout_multiplier}</span>
    </button>
  )
}

function NumberGrid({ minAmount, numbers, onSelect, selectedNumbers }) {
  return (
    <div className="grid w-full min-w-0 grid-cols-5 gap-1.5 sm:grid-cols-10" aria-label="Números disponibles">
      {numbers.map((item) => {
        const low = item.available && moneyToCents(item.remaining_amount) < moneyToCents(minAmount) * 5n
        const selected = selectedNumbers.has(item.number)
        return <button key={item.number} type="button" disabled={!item.available} onClick={() => onSelect(item)} aria-pressed={selected} aria-label={`Número ${item.number}, ${item.available ? `disponible hasta ${formatMoney(item.remaining_amount)}` : 'agotado'}`} className={`h-10 rounded-lg border text-sm font-black transition ${selected ? 'border-gold-400 bg-gold-400 text-night-950 shadow-md shadow-gold-400/20' : item.available ? low ? 'border-coral-400/35 bg-coral-400/10 text-[#ffabb3] hover:border-coral-400' : 'border-jade-400/20 bg-jade-400/[0.08] text-white hover:border-jade-400/60 hover:bg-jade-400/15' : 'cursor-not-allowed border-white/[0.05] bg-white/[0.025] text-[#5d6480] line-through'}`}>{item.number}</button>
      })}
    </div>
  )
}

export function CreateBetPage() {
  const { refreshProfile, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const openDraws = useQuery({ queryKey: drawKeys.open(), queryFn: drawsApi.open, refetchOnWindowFocus: true })
  const balance = useQuery({ queryKey: walletKeys.balance(), queryFn: walletApi.balance })
  const [chosenDrawId, setChosenDrawId] = useState(null)
  const [items, setItems] = useState(() => queryClient.getQueryData(DRAFT_KEY) || [])
  const [confirmation, setConfirmation] = useState(null)
  const [intent, setIntent] = useState(() => getPendingIntent(OPERATION))
  const [error, setError] = useState(null)
  const [builderError, setBuilderError] = useState(null)
  const [needsKyc, setNeedsKyc] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [checkError, setCheckError] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const preparingRef = useRef(false)

  const draws = openDraws.data?.draws || []
  const selectedDrawId = chosenDrawId ?? draws[0]?.draw_id ?? null
  const selectedDraw = draws.find((draw) => String(draw.draw_id) === String(selectedDrawId))
  const availability = useQuery({
    queryKey: drawKeys.availability(selectedDrawId),
    queryFn: () => drawsApi.availability(selectedDrawId),
    enabled: Boolean(selectedDrawId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  const total = centsToMoney(ticketTotalCents(items))

  const selectedNumbers = useMemo(() => new Set(items
    .filter((item) => String(item.drawId) === String(selectedDrawId))
    .map((item) => item.number)), [items, selectedDrawId])

  const refreshKyc = useMutation({
    mutationFn: refreshProfile,
    onSuccess: (profile) => {
      if (profile.kycStatus === 'APPROVED') setNeedsKyc(false)
    },
    onError: (refreshError) => setError(refreshError),
  })

  const persistItems = (next) => {
    setItems(next)
    queryClient.setQueryData(DRAFT_KEY, next)
  }

  const toggleNumber = (numberAvailability) => {
    setBuilderError(null)
    setNeedsKyc(false)
    if (!selectedDraw || !numberAvailability?.available) return

    const existingIndex = items.findIndex((item) => String(item.drawId) === String(selectedDraw.draw_id) && item.number === numberAvailability.number)
    if (existingIndex >= 0) {
      removeItem(existingIndex)
      return
    }

    if (items.some((item) => String(item.drawId) !== String(selectedDraw.draw_id))) {
      setBuilderError('Cada boleto debe contener números de un solo sorteo y modalidad. Elimina la selección actual antes de cambiar.')
      return
    }
    if (items.length >= 100) {
      setBuilderError('Un boleto admite como máximo 100 jugadas.')
      return
    }

    persistItems([...items, {
      drawId: selectedDraw.draw_id,
      lottery: selectedDraw.lottery,
      modality: selectedDraw.modality,
      drawDate: selectedDraw.draw_date,
      scheduleTime: selectedDraw.schedule_time,
      number: numberAvailability.number,
      amount: '',
      payoutMultiplier: selectedDraw.payout_multiplier,
      payoutRuleVersion: selectedDraw.payout_rule_version,
    }])
  }

  const changeItemAmount = (index, value) => persistItems(items.map((item, itemIndex) => itemIndex === index ? { ...item, amount: value } : item))
  const removeItem = (index) => persistItems(items.filter((_, itemIndex) => itemIndex !== index))

  const createMutation = useMutation({
    mutationFn: ({ body }) => betsApi.place(body),
    onSuccess: async (result, variables) => {
      resolveIntent(OPERATION, variables.intent.requestId)
      setIntent(null)
      persistItems([])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: betKeys.all }),
        queryClient.invalidateQueries({ queryKey: walletKeys.all }),
        queryClient.invalidateQueries({ queryKey: drawKeys.all }),
      ])
      navigate(`/app/tickets/${result.bet_id}`, { replace: true })
    },
    onError: (mutationError, variables) => {
      const conflict = mutationError?.code === 'IDEMPOTENCY_KEY_CONFLICT' || mutationError?.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH'
      if (isUncertainFinancialError(mutationError) || conflict) {
        setIntent(variables.intent)
      } else {
        resolveIntent(OPERATION, variables.intent.requestId)
        setIntent(null)
        if (mutationError?.code === 'KYC_REQUIRED') {
          setNeedsKyc(true)
          setError(null)
        } else {
          setError(mutationError)
        }
        if (['DRAW_UNAVAILABLE', 'DRAW_CLOSED', 'DRAW_OR_NUMBER_UNAVAILABLE', 'NUMBER_LIMIT_EXCEEDED'].includes(mutationError?.code)) {
          queryClient.invalidateQueries({ queryKey: drawKeys.all })
        }
      }
      setConfirmation(null)
    },
    onSettled: () => {
      preparingRef.current = false
      setPreparing(false)
    },
  })

  const checkMutation = useMutation({
    mutationFn: () => betsApi.list({ page: 1, limit: 10, requestId: intent.requestId }),
    onSuccess: async (result) => {
      const ticket = result.tickets[0]
      setCheckError(null)
      if (!ticket) return setNotFound(true)
      resolveIntent(OPERATION, intent.requestId)
      setIntent(null)
      persistItems([])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: walletKeys.all }),
        queryClient.invalidateQueries({ queryKey: drawKeys.all }),
      ])
      navigate(`/app/tickets/${ticket.id}`, { replace: true })
    },
    onError: (lookupError) => setCheckError(lookupError),
  })

  const reviewTicket = async () => {
    setBuilderError(null)
    setError(null)
    setNeedsKyc(false)
    if (!openDraws.data?.sales_enabled) {
      setBuilderError('La venta de apuestas está temporalmente suspendida. Puedes conservar el boleto y volver más tarde.')
      return
    }
    if (user.kycStatus !== 'APPROVED') {
      setNeedsKyc(true)
      return
    }
    try {
      const drawIds = [...new Set(items.map((item) => item.drawId))]
      const currentAvailability = await Promise.all(drawIds.map((drawId) => queryClient.fetchQuery({
        queryKey: drawKeys.availability(drawId),
        queryFn: () => drawsApi.availability(drawId),
        staleTime: 0,
      })))
      const currentRules = new Map(currentAvailability.map((result) => [String(result.draw.draw_id), result.draw]))
      const multiplierChanged = items.some((item) => {
        const currentDraw = currentRules.get(String(item.drawId))
        return !currentDraw
          || String(item.payoutMultiplier) !== String(currentDraw.payout_multiplier)
          || Number(item.payoutRuleVersion) !== Number(currentDraw.payout_rule_version)
      })
      if (multiplierChanged) {
        persistItems(items.map((item) => {
          const currentDraw = currentRules.get(String(item.drawId))
          return currentDraw ? { ...item, payoutMultiplier: currentDraw.payout_multiplier, payoutRuleVersion: currentDraw.payout_rule_version } : item
        }))
        setBuilderError('El multiplicador de premio cambió. Revisa el nuevo premio mostrado y vuelve a seleccionar “Revisar apuesta” para confirmar.')
        return
      }
      const validationError = validateTicket(items, {
        balance: balance.data.available_balance,
        maxTotal: openDraws.data.bet_rules.max_ticket_total,
        minPerNumber: openDraws.data.bet_rules.min_bet_per_number,
        availability: availabilityMap(currentAvailability),
      })
      if (validationError) return setBuilderError(validationError)
      setConfirmation([...items])
    } catch (reviewError) {
      setError(reviewError)
    }
  }

  const submit = async () => {
    const source = confirmation || items
    if (!source.length || preparingRef.current || createMutation.isPending) return
    preparingRef.current = true
    setPreparing(true)
    try {
      const bets = canonicalBetPayload(source)
      const nextIntent = await prepareIntent(OPERATION, bets)
      setIntent(nextIntent)
      setNotFound(false)
      createMutation.mutate({ body: { request_id: nextIntent.requestId, bets }, intent: nextIntent })
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
    setNotFound(false)
    setCheckError(null)
    setError(null)
  }

  return <PlayerPage>
    <PageHeader eyebrow="Sorteos en vivo" title="Crea tu jugada" subtitle="Garantizamos un juego seguro y confiable." actions={<Badge variant={openDraws.data?.sales_enabled ? 'success' : 'warning'}>{openDraws.data?.sales_enabled ? 'Ventas abiertas' : 'Ventas suspendidas'}</Badge>} />
    <div className="mt-6 grid gap-5">
      {intent && <IntentRecoveryCard operationLabel="boleto" intent={intent} checking={checkMutation.isPending} checkError={checkError} notFound={notFound} canRetry={notFound && items.length > 0} onCheck={() => checkMutation.mutate()} onRetry={submit} onAbandon={discard} />}
      <FinancialErrorAlert error={error} />
      {balance.isError && <QueryErrorState error={balance.error} onRetry={balance.refetch} />}
      {builderError && <Alert title="Revisa el boleto" variant="danger"><p>{builderError}</p></Alert>}
      {needsKyc && <Alert title="Verifica tu identidad para apostar" variant="warning"><p>Puedes seguir explorando y conservar este boleto en la sesión. Tus datos personales deben estar verificados para descontar saldo y confirmar la apuesta.</p><div className="mt-3 flex flex-wrap gap-2"><ButtonLink variant="secondary" to="/app/perfil"><ShieldCheck size={17} aria-hidden="true" /> Ir a verificación</ButtonLink><Button variant="ghost" loading={refreshKyc.isPending} onClick={() => refreshKyc.mutate()}><RefreshCw size={16} aria-hidden="true" /> Actualizar estado</Button></div></Alert>}
    </div>

    {openDraws.isPending ? <div className="mt-7 grid gap-4"><CardSkeleton /><CardSkeleton /></div> : openDraws.isError ? <div className="mt-7"><QueryErrorState error={openDraws.error} onRetry={openDraws.refetch} /></div> : draws.length === 0 ? <div className="mt-7"><PageState title="No hay sorteos abiertos">Cuando los jobs automáticos abran el próximo sorteo aparecerá aquí con su horario oficial.</PageState></div> : <div className="mt-7 grid items-start gap-6">
      <div className="min-w-0 grid gap-6">
        <section className="surface-panel rounded-3xl p-5 sm:p-6" aria-labelledby="draws-title">
          <div className="flex items-center justify-between gap-4"><div><h2 id="draws-title" className="text-xl font-black text-white">1. Elige un sorteo</h2><p className="mt-1 text-sm text-muted">Costa Rica</p></div><Trophy className="text-gold-400" size={25} aria-hidden="true" /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{draws.map((draw) => <DrawCard key={draw.draw_id} draw={draw} active={String(selectedDrawId) === String(draw.draw_id)} onSelect={() => {
            if (items.length > 0 && items.some((item) => String(item.drawId) !== String(draw.draw_id))) {
              setBuilderError('Cada boleto debe contener números de un solo sorteo y modalidad. Elimina la selección actual antes de cambiar.')
              return
            }
            setChosenDrawId(draw.draw_id)
            setBuilderError(null)
          }} />)}</div>
        </section>

        <section className="surface-panel rounded-3xl p-5 sm:p-6" aria-labelledby="numbers-title">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 id="numbers-title" className="text-xl font-black text-white">2. Selecciona uno o varios números</h2><p className="mt-1 text-sm text-muted">Toca nuevamente un número para quitarlo. La disponibilidad se comprobará al confirmar.</p></div><Button variant="secondary" loading={availability.isFetching} onClick={() => availability.refetch()}><RefreshCw size={16} aria-hidden="true" /> Actualizar</Button></div>
          <div className="mt-5">{availability.isPending ? <CardSkeleton /> : availability.isError ? <QueryErrorState error={availability.error} onRetry={availability.refetch} /> : <NumberGrid minAmount={openDraws.data.bet_rules.min_bet_per_number} numbers={availability.data.numbers} selectedNumbers={selectedNumbers} onSelect={toggleNumber} />}</div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-night-950/45 p-4" aria-labelledby="amounts-title">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 id="amounts-title" className="font-black text-white">3. Define los montos</h3><p className="mt-1 text-xs text-muted">Cada número tiene su propio monto.</p></div><Badge variant={items.length ? 'warning' : 'neutral'}>{items.length} seleccionados</Badge></div>
            {items.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-muted">Selecciona los números que deseas jugar.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item, index) => {
              const currentAvailability = availability.data?.numbers?.find((number) => number.number === item.number)
              const potentialPayout = calculatePotentialPayout(item.amount, item.payoutMultiplier)
              return <article key={`${item.drawId}:${item.number}`} className="rounded-xl border border-white/10 bg-white/[0.045] p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-muted">Número <span className="ml-1 text-xl font-black text-gold-400">{item.number}</span></p><button type="button" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-coral-400/10 hover:text-coral-400" onClick={() => removeItem(index)} aria-label={`Eliminar número ${item.number}`}><Trash2 size={16} aria-hidden="true" /></button></div><label className="mt-3 block text-xs font-bold text-muted" htmlFor={`selected-amount-${index}`}>Monto individual</label><input id={`selected-amount-${index}`} aria-label={`Monto para número ${item.number} de ${item.lottery}`} inputMode="decimal" placeholder={openDraws.data.bet_rules.min_bet_per_number} value={item.amount} onChange={(event) => changeItemAmount(index, event.target.value)} className="mt-1 min-h-10 w-full rounded-xl border border-white/12 bg-night-950/65 px-3 text-sm font-bold text-white focus:border-electric-400 focus:outline-none focus:ring-2 focus:ring-electric-500/25" /><p className="mt-2 text-[0.7rem] leading-4 text-muted">Disponible: {currentAvailability ? formatMoney(currentAvailability.remaining_amount) : 'por comprobar'} · Mínimo: {formatMoney(openDraws.data.bet_rules.min_bet_per_number)}</p><p className="mt-1 text-xs font-bold text-jade-400">Premio ×{item.payoutMultiplier} · {potentialPayout ? formatMoney(potentialPayout) : 'define el monto'}</p></article>
            })}</div>}
          </div>
        </section>
      </div>

      <aside className="surface-panel rounded-3xl p-5 sm:p-6" aria-labelledby="ticket-title">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-electric-400">Boleto actual</p><h2 id="ticket-title" className="mt-1 text-xl font-black text-white">{items.length} {items.length === 1 ? 'jugada' : 'jugadas'}</h2></div><span className="grid size-11 place-items-center rounded-2xl bg-electric-500/15 text-electric-400"><ShoppingCart size={21} aria-hidden="true" /></span></div>
        {items.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-white/15 p-5 text-sm leading-6 text-muted">Selecciona un sorteo y toca uno o varios números.</p> : <div className="mt-5 grid max-h-[29rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">{items.map((item, index) => <article key={`${item.drawId}:${item.number}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-3"><div><p className="text-xs font-bold text-muted">{item.lottery} · {item.modality} · ×{item.payoutMultiplier}</p><p className="mt-1 text-sm font-black text-white">Número <span className="text-gold-400">{item.number}</span></p></div><div className="flex items-center gap-2"><strong className="text-sm text-white">{item.amount ? formatMoney(item.amount) : 'Sin monto'}</strong><button type="button" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-coral-400/10 hover:text-coral-400" onClick={() => removeItem(index)} aria-label={`Eliminar número ${item.number} del boleto`}><Trash2 size={16} aria-hidden="true" /></button></div></article>)}</div>}
        <div className="mt-5 border-t border-white/10 pt-5"><div className="flex items-center justify-between"><span className="text-sm font-bold text-muted">Total del boleto</span><span className="text-2xl font-black text-white">{formatMoney(total)}</span></div><p className="mt-2 flex items-center gap-2 text-xs text-muted"><CircleDollarSign size={15} aria-hidden="true" /> Saldo: {balance.isSuccess ? formatMoney(balance.data.available_balance) : 'consultando…'}</p><p className="mt-1 text-xs text-muted">Máximo: {formatMoney(openDraws.data.bet_rules.max_ticket_total)}</p><Button className="mt-5 w-full" variant="success" onClick={reviewTicket} disabled={!items.length || !balance.isSuccess || Boolean(intent && !notFound)}>Revisar apuesta</Button></div>
      </aside>
    </div>}

    <ConfirmDialog open={Boolean(confirmation)} title="Confirma tu apuesta" confirmLabel="Confirmar y apostar" confirmLoading={preparing || createMutation.isPending} onClose={() => setConfirmation(null)} onConfirm={submit}>
      <div className="grid gap-3"><div className="flex justify-between gap-4"><span>Jugadas</span><strong className="text-white">{confirmation?.length || 0}</strong></div><div className="flex justify-between gap-4"><span>Total</span><strong className="text-xl text-white">{formatMoney(confirmation ? centsToMoney(ticketTotalCents(confirmation)) : '0.00')}</strong></div></div>
      <div className="mt-4 max-h-52 overflow-y-auto rounded-xl bg-night-950/55 p-3">{confirmation?.map((item) => <div className="flex justify-between gap-3 border-b border-white/[0.07] py-2 text-sm last:border-0" key={`${item.drawId}:${item.number}`}><span>{item.lottery} · {item.modality} · <strong className="text-gold-400">{item.number}</strong> · ×{item.payoutMultiplier}</span><span className="text-right"><strong className="block text-white">{formatMoney(item.amount)}</strong><small className="text-jade-400">Premio {formatMoney(calculatePotentialPayout(item.amount, item.payoutMultiplier))}</small></span></div>)}</div>
      <Alert title="Importante" variant="warning"><p>Una vez confirmada, la apuesta no puede editarse ni cancelarse.</p></Alert>
    </ConfirmDialog>
  </PlayerPage>
}
