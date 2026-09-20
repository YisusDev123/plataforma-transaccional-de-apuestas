import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, adminKeys } from './admin-api.js'
import { AdminError, AdminSuccess } from './AdminFeedback.jsx'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { Button } from '../../shared/components/Button.jsx'
import { FormField } from '../../shared/components/FormField.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'

const sections = [
  { key: 'system_status', title: 'Estado del sistema', fields: [{ key: 'maintenance_mode', label: 'Modo mantenimiento', type: 'boolean' }, { key: 'sales_enabled', label: 'Ventas habilitadas', type: 'boolean' }, { key: 'message', label: 'Mensaje operativo', type: 'text' }] },
  { key: 'financial_rules', title: 'Reglas de apuestas', fields: [{ key: 'min_bet_per_number', label: 'Mínimo por número', type: 'money' }, { key: 'max_ticket_total', label: 'Máximo por boleto', type: 'money' }] },
  { key: 'draw_defaults', title: 'Valores de sorteos automáticos', fields: [{ key: 'default_risk_limit', label: 'Disponibilidad por número desde ahora', type: 'money' }, { key: 'auto_close_minutes_before', label: 'Cierre previo (10 a 20 minutos)', type: 'integer', min: 10, max: 20 }] },
  { key: 'kyc_policies', title: 'Políticas KYC', fields: [{ key: 'require_kyc_for_deposits', label: 'Exigir KYC para depósitos', type: 'boolean' }, { key: 'require_kyc_for_withdrawals', label: 'Exigir KYC para retiros', type: 'boolean' }] },
  { key: 'deposits_rules', title: 'Depósitos', fields: [{ key: 'min_deposit', label: 'Depósito mínimo', type: 'money' }] },
  { key: 'withdraws_rules', title: 'Retiros', fields: [{ key: 'min_withdrawal', label: 'Retiro mínimo', type: 'money' }] },
]

function RuleSection({ config, values }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => Object.fromEntries(config.fields.map((field) => [field.key, values[field.key]])))
  const [formError, setFormError] = useState('')
  const mutation = useMutation({ mutationFn: (payload) => adminApi.updateSetting(config.key, payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.settings() }) })
  const update = (field, raw) => setForm((current) => ({ ...current, [field.key]: field.type === 'boolean' ? raw : raw }))
  const submit = () => {
    const payload = {}
    for (const field of config.fields) {
      const invalidMoney = field.type === 'money' && !/^\d+(?:\.\d{1,2})?$/.test(String(form[field.key]))
      const invalidInteger = field.type === 'integer' && (
        !/^\d+$/.test(String(form[field.key]))
        || (field.min !== undefined && Number(form[field.key]) < field.min)
        || (field.max !== undefined && Number(form[field.key]) > field.max)
      )
      if (invalidMoney || invalidInteger) return setFormError(`Revisa el campo “${field.label}”.`)
      payload[field.key] = field.type === 'money' || field.type === 'integer' ? Number(form[field.key]) : form[field.key]
    }
    setFormError(''); mutation.mutate(payload)
  }
  return <article className="surface-soft rounded-3xl p-5 sm:p-6"><h2 className="text-lg font-black text-white">{config.title}</h2><div className="mt-5 grid gap-4">{config.fields.map((field) => field.type === 'boolean' ? <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-white/10 bg-night-950/45 px-4 text-sm font-bold" key={field.key}><span>{field.label}</span><input type="checkbox" checked={Boolean(form[field.key])} onChange={(event) => update(field, event.target.checked)} className="size-5 accent-[#7657ff]" /></label> : <FormField key={field.key} label={field.label} inputMode={field.type === 'text' ? undefined : 'decimal'} value={form[field.key] ?? ''} onChange={(event) => update(field, event.target.value)} maxLength={field.type === 'text' ? 255 : undefined} />)}</div>{formError && <p className="mt-3 text-sm text-coral-400">{formError}</p>}<div className="mt-5 grid gap-3"><AdminSuccess message={mutation.isSuccess ? 'Cambios guardados correctamente.' : ''} /><AdminError error={mutation.error} /></div><Button className="mt-5" loading={mutation.isPending} onClick={submit}>Guardar sección</Button></article>
}

export function AdminRulesPage() {
  const query = useQuery({ queryKey: adminKeys.settings(), queryFn: adminApi.settings })
  return <AdminLayout><PageHeader eyebrow="Configuración global" title="Reglas del sistema" subtitle="Cada sección se guarda de forma independiente. Los campos no enviados conservan su valor actual." /><section className="mt-7">{query.isPending ? <div className="grid gap-4 lg:grid-cols-2"><CardSkeleton /><CardSkeleton /></div> : query.isError && !query.data ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : <><AdminError error={query.isError ? query.error : null} /><div className="mt-4 grid items-start gap-5 lg:grid-cols-2">{sections.map((section) => <RuleSection key={section.key} config={section} values={query.data[section.key]} />)}</div></>}</section></AdminLayout>
}
