import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Percent } from 'lucide-react'
import { adminApi, adminKeys } from './admin-api.js'
import { AdminError, AdminSuccess } from './AdminFeedback.jsx'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { Badge } from '../../shared/components/Badge.jsx'
import { Button } from '../../shared/components/Button.jsx'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.jsx'
import { DataTable } from '../../shared/components/DataTable.jsx'
import { FormField } from '../../shared/components/FormField.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'

export function AdminPayoutRulesPage() {
  const [selected, setSelected] = useState(null)
  const [multiplier, setMultiplier] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: adminKeys.payoutRules(), queryFn: adminApi.payoutRules })
  const mutation = useMutation({
    mutationFn: () => adminApi.updatePayoutRule(selected.id, {
      multiplier: Number(multiplier),
      expected_version: selected.version,
    }),
    onSuccess: async () => {
      setSuccessMessage('Multiplicador actualizado correctamente.')
      setSelected(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.payoutRules() }),
        queryClient.invalidateQueries({ queryKey: ['draws'] }),
      ])
    },
    onError: (error) => {
      if (error?.code === 'PAYOUT_RULE_CHANGED') query.refetch()
    },
  })

  const confirm = () => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(multiplier) || Number(multiplier) <= 0) return setFormError('Ingresa un multiplicador mayor a cero con máximo dos decimales.')
    setFormError('')
    mutation.mutate()
  }

  const rows = (query.data?.rules || []).map((rule) => ({
    id: rule.id,
    lottery: <strong className="text-white">{rule.lottery}</strong>,
    modality: rule.modality,
    multiplier: <span className="text-lg font-black text-gold-400">×{rule.multiplier}</span>,
    status: <Badge variant={rule.isActive ? 'success' : 'neutral'}>{rule.isActive ? 'Activo' : 'Inactivo'}</Badge>,
    action: <Button className="min-h-9 px-3 py-1.5" variant="secondary" disabled={!rule.isActive} onClick={() => { setSuccessMessage(''); setSelected(rule); setMultiplier(rule.multiplier); setFormError(''); mutation.reset() }}><Pencil size={15} aria-hidden="true" /> Editar</Button>,
  }))

  return <AdminLayout>
    <PageHeader eyebrow="Premios" title="Multiplicadores por modalidad" subtitle="Los cambios aplican sólo a apuestas futuras. Los tickets aceptados conservan el multiplicador registrado al confirmar." actions={<span className="grid size-12 place-items-center rounded-2xl bg-gold-400/10 text-gold-400"><Percent size={23} aria-hidden="true" /></span>} />
    <div className="mt-6 grid gap-3"><AdminSuccess message={successMessage} /><AdminError error={mutation.error} /></div>
    <section className="mt-6">{query.isPending ? <CardSkeleton /> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : <DataTable caption="Multiplicadores de premio" columns={[{ key: 'lottery', label: 'Lotería' }, { key: 'modality', label: 'Modalidad' }, { key: 'multiplier', label: 'Multiplicador' }, { key: 'status', label: 'Estado' }, { key: 'action', label: 'Acción' }]} rows={rows} />}</section>
    <ConfirmDialog open={Boolean(selected)} title={`Modificar ${selected?.lottery} · ${selected?.modality}`} confirmLabel="Guardar multiplicador" confirmLoading={mutation.isPending} onClose={() => setSelected(null)} onConfirm={confirm}>
      <p className="mb-4 text-sm">Multiplicador actual: <strong className="text-white">×{selected?.multiplier}</strong></p>
      <FormField label="Nuevo multiplicador" inputMode="decimal" value={multiplier} onChange={(event) => setMultiplier(event.target.value)} error={formError} />
      <p className="mt-3 text-sm">El nuevo valor se mostrará al jugador antes de confirmar su apuesta.</p>
    </ConfirmDialog>
  </AdminLayout>
}
