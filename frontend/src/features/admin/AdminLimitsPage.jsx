import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { adminApi, adminKeys } from './admin-api.js'
import { AdminError, AdminSuccess } from './AdminFeedback.jsx'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { Button, ButtonLink } from '../../shared/components/Button.jsx'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.jsx'
import { DataTable } from '../../shared/components/DataTable.jsx'
import { FormField } from '../../shared/components/FormField.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { PageState } from '../../shared/components/PageState.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { SelectField } from '../../shared/components/SelectField.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { formatMoney, moneyToCents } from '../../shared/utils/formatters.js'

const availabilityOptions = [
  { value: 'ALL', label: 'Todos' },
  { value: 'EXHAUSTED', label: 'Agotados' },
  { value: 'AVAILABLE', label: 'Con disponibilidad' },
]

export function AdminLimitsPage() {
  const { id } = useParams()
  const [selected, setSelected] = useState(null)
  const [amount, setAmount] = useState('')
  const [search, setSearch] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: adminKeys.limits(id), queryFn: () => adminApi.limits(id) })
  const mutation = useMutation({
    mutationFn: () => adminApi.updateLimit({
      draw_id: Number(id),
      number_played: Number(selected.number),
      remaining_amount: Number(amount),
      expected_max_amount: Number(selected.max_amount),
    }),
    onSuccess: async () => {
      setSuccessMessage('Disponibilidad actualizada correctamente.')
      setSelected(null)
      await queryClient.invalidateQueries({ queryKey: adminKeys.limits(id) })
    },
    onError: (error) => {
      if (['LIMIT_CHANGED', 'LIMIT_BELOW_EXPOSURE'].includes(error?.code)) query.refetch()
    },
  })

  const confirm = () => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) return setFormError('Ingresa un monto no negativo con máximo dos decimales.')
    setFormError('')
    mutation.mutate()
  }

  const editable = ['PENDING', 'OPEN'].includes(query.data?.draw?.status)
  const filteredNumbers = useMemo(() => (query.data?.numbers || []).filter((item) => {
    const matchesNumber = !search || item.number.includes(search.padStart(2, '0')) || item.number.includes(search)
    const exhausted = moneyToCents(item.remaining_amount) === 0n
    const matchesAvailability = availabilityFilter === 'ALL'
      || (availabilityFilter === 'EXHAUSTED' && exhausted)
      || (availabilityFilter === 'AVAILABLE' && !exhausted)
    return matchesNumber && matchesAvailability
  }), [availabilityFilter, query.data?.numbers, search])

  const rows = filteredNumbers.map((item) => {
    const exhausted = moneyToCents(item.remaining_amount) === 0n
    return {
      id: item.number,
      number: <span className="text-lg font-black text-gold-400">{item.number}</span>,
      maximum: formatMoney(item.max_amount),
      exposed: formatMoney(item.current_amount),
      remaining: <strong className={exhausted ? 'text-coral-400' : 'text-jade-400'}>{exhausted ? 'Agotado' : formatMoney(item.remaining_amount)}</strong>,
      action: editable ? <Button className="min-h-9 px-3 py-1.5" variant="secondary" onClick={() => { setSuccessMessage(''); setSelected(item); setAmount(item.remaining_amount); setFormError(''); mutation.reset() }}><Pencil size={15} aria-hidden="true" /> Editar</Button> : 'Histórico',
    }
  })

  const preview = selected && /^\d+(?:\.\d{1,2})?$/.test(amount)
    ? moneyToCents(amount)
    : null

  return <AdminLayout>
    <PageHeader eyebrow="Disponibilidad por número" title={query.data ? `${query.data.draw.lottery} · ${query.data.draw.modality}` : `Límites del sorteo ${id}`} subtitle="Define cuánto puede venderse desde ahora sin alterar el monto ya vendido." actions={<ButtonLink variant="secondary" to="/admin/sorteos"><ArrowLeft size={17} aria-hidden="true" /> Volver</ButtonLink>} />
    <div className="mt-6 grid gap-3"><AdminSuccess message={successMessage} /><AdminError error={mutation.error} /></div>
    <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-2">
      <FormField label="Buscar número" inputMode="numeric" maxLength={2} value={search} onChange={(event) => setSearch(event.target.value.replace(/\D/g, '').slice(0, 2))} />
      <SelectField label="Disponibilidad" options={availabilityOptions} value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)} />
    </div>
    <section className="mt-6">
      {query.isPending ? <CardSkeleton /> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : rows.length === 0 ? <PageState title="Sin coincidencias">No hay números que coincidan con estos filtros.</PageState> : <DataTable caption="Matriz de límites 00 a 99" columns={[{ key: 'number', label: 'Número' }, { key: 'maximum', label: 'Límite máximo' }, { key: 'exposed', label: 'Monto vendido' }, { key: 'remaining', label: 'Disponible' }, { key: 'action', label: 'Acción' }]} rows={rows} />}
    </section>
    <ConfirmDialog open={Boolean(selected)} title={`Modificar disponibilidad del número ${selected?.number}`} confirmLabel="Guardar disponibilidad" confirmLoading={mutation.isPending} onClose={() => setSelected(null)} onConfirm={confirm}>
      <dl className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-night-950/55 p-3 text-sm">
        <div><dt>Monto vendido</dt><dd className="mt-1 font-black text-white">{formatMoney(selected?.current_amount)}</dd></div>
        <div><dt>Límite actual</dt><dd className="mt-1 font-black text-white">{formatMoney(selected?.max_amount)}</dd></div>
      </dl>
      <FormField label="Monto disponible desde ahora" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} error={formError} />
      {preview !== null && <p className="mt-3 text-sm font-bold text-jade-400">Nueva disponibilidad: {formatMoney((Number(preview) / 100).toFixed(2))}</p>}
      <p className="mt-3 text-sm">El cambio se aplicará sólo a este número y sorteo. No modifica apuestas ya aceptadas.</p>
    </ConfirmDialog>
  </AdminLayout>
}
