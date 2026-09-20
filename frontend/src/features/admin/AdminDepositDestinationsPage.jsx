import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Landmark, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { adminApi, adminKeys } from './admin-api.js'
import { AdminError, AdminSuccess } from './AdminFeedback.jsx'
import { bankDestinationSchema, sinpeDestinationSchema } from './deposit-destination-schema.js'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { Badge } from '../../shared/components/Badge.jsx'
import { Button } from '../../shared/components/Button.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.jsx'
import { FormField } from '../../shared/components/FormField.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { formatDateTime } from '../../shared/utils/formatters.js'

const definitions = {
  BANK_ACCOUNT: {
    title: 'Cuenta bancaria',
    label: 'IBAN de Costa Rica',
    hint: 'Formato: CR seguido de 20 dígitos.',
    icon: Landmark,
    schema: bankDestinationSchema,
  },
  SINPE_MOVIL: {
    title: 'SINPE Móvil',
    label: 'Número de teléfono',
    hint: 'Ingresa los 8 dígitos del teléfono.',
    icon: Smartphone,
    schema: sinpeDestinationSchema,
  },
}

function DestinationEditor({ type, destination, onSaved }) {
  const definition = definitions[type]
  const Icon = definition.icon
  const [confirmation, setConfirmation] = useState(null)
  const form = useForm({
    resolver: zodResolver(definition.schema),
    defaultValues: { destinationValue: '', accountHolder: '' },
  })
  const mutation = useMutation({
    mutationFn: (values) => adminApi.updateDepositDestination({ type, ...values }),
    onSuccess: async () => {
      setConfirmation(null)
      await onSaved(type)
    },
  })

  useEffect(() => {
    form.reset({
      destinationValue: destination?.destinationValue || '',
      accountHolder: destination?.accountHolder || '',
    })
  }, [destination, form])

  const openConfirmation = form.handleSubmit((values) => {
    mutation.reset()
    setConfirmation(values)
  })

  return <section className="surface-panel rounded-3xl p-5 sm:p-7">
    <div className="flex items-start justify-between gap-4">
      <div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-electric-500/15 text-electric-400"><Icon size={21} aria-hidden="true" /></span><div><h2 className="text-xl font-black text-white">{definition.title}</h2><p className="mt-1 text-sm text-muted">{destination ? `Versión ${destination.version} · actualizada ${formatDateTime(destination.createdAt)}` : 'Aún no configurada'}</p></div></div>
      <Badge variant={destination ? 'success' : 'neutral'}>{destination ? 'Disponible' : 'Pendiente'}</Badge>
    </div>
    <form className="mt-6 grid gap-4" onSubmit={openConfirmation} noValidate>
      <FormField label={definition.label} hint={definition.hint} autoComplete="off" error={form.formState.errors.destinationValue?.message} {...form.register('destinationValue')} />
      <FormField label="Nombre del titular" autoComplete="name" error={form.formState.errors.accountHolder?.message} {...form.register('accountHolder')} />
      <Button className="mt-1 sm:justify-self-start" type="submit">{destination ? 'Revisar actualización' : 'Revisar configuración'}</Button>
    </form>
    <div className="mt-4"><AdminError error={mutation.error} /></div>
    <ConfirmDialog open={Boolean(confirmation)} title={`Confirmar ${definition.title.toLowerCase()}`} confirmLabel="Guardar destino" confirmLoading={mutation.isPending} onClose={() => setConfirmation(null)} onConfirm={() => mutation.mutate(confirmation)}>
      <dl className="grid gap-3"><div><dt className="text-xs font-bold uppercase tracking-wider">{definition.label}</dt><dd className="mt-1 break-all font-semibold text-white">{confirmation?.destinationValue}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wider">Titular</dt><dd className="mt-1 font-semibold text-white">{confirmation?.accountHolder}</dd></div></dl>
      <p className="mt-4 text-sm">El cambio aplicará a solicitudes nuevas. Los depósitos ya registrados conservarán el destino anterior.</p>
    </ConfirmDialog>
  </section>
}

export function AdminDepositDestinationsPage() {
  const queryClient = useQueryClient()
  const [successMessage, setSuccessMessage] = useState('')
  const query = useQuery({ queryKey: adminKeys.depositDestinations(), queryFn: adminApi.depositDestinations })
  const destinations = query.data?.destinations || []
  const byType = Object.fromEntries(destinations.map((destination) => [destination.type, destination]))
  const onSaved = async (type) => {
    setSuccessMessage(`${definitions[type].title} actualizada correctamente.`)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.depositDestinations() }),
      queryClient.invalidateQueries({ queryKey: ['wallet', 'operation-rules'] }),
    ])
  }

  return <AdminLayout>
    <PageHeader eyebrow="Configuración financiera" title="Destinos de depósito" subtitle="Publica la cuenta bancaria y el SINPE Móvil que los jugadores pueden utilizar. Cada cambio crea una versión histórica." actions={<span className="grid size-12 place-items-center rounded-2xl bg-electric-500/15 text-electric-400"><Building2 size={23} aria-hidden="true" /></span>} />
    <div className="mt-6"><AdminSuccess message={successMessage} /></div>
    <div className="mt-6">{query.isPending ? <CardSkeleton /> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : <div className="grid gap-5 xl:grid-cols-2"><DestinationEditor type="BANK_ACCOUNT" destination={byType.BANK_ACCOUNT} onSaved={onSaved} /><DestinationEditor type="SINPE_MOVIL" destination={byType.SINPE_MOVIL} onSaved={onSaved} /></div>}</div>
  </AdminLayout>
}
