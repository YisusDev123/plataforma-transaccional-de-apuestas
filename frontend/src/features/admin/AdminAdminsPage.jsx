import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Plus, RotateCcw } from 'lucide-react'
import { adminApi, adminKeys } from './admin-api.js'
import { AdminError, AdminSuccess } from './AdminFeedback.jsx'
import { AdminLayout } from '../../shared/layouts/AdminLayout.jsx'
import { Button } from '../../shared/components/Button.jsx'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog.jsx'
import { DataTable } from '../../shared/components/DataTable.jsx'
import { FormField } from '../../shared/components/FormField.jsx'
import { PageHeader } from '../../shared/components/PageHeader.jsx'
import { QueryErrorState } from '../../shared/components/QueryState.jsx'
import { CardSkeleton } from '../../shared/components/Skeleton.jsx'
import { StatusBadge } from '../../shared/components/StatusBadge.jsx'
import { formatDateTime } from '../../shared/utils/formatters.js'

export function AdminAdminsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [formError, setFormError] = useState('')
  const [action, setAction] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: adminKeys.admins(), queryFn: adminApi.admins })
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.admins() })
  const createMutation = useMutation({ mutationFn: () => adminApi.createAdmin({ ...form, role: 'EMPLOYEE' }), onSuccess: async () => { setSuccessMessage('Empleado creado correctamente.'); setShowCreate(false); setForm({ email: '', password: '' }); await refresh() } })
  const statusMutation = useMutation({ mutationFn: () => action.type === 'suspend' ? adminApi.suspendAdmin(action.admin.id) : adminApi.reactivateAdmin(action.admin.id), onSuccess: async () => { setSuccessMessage(action.type === 'suspend' ? 'Empleado suspendido correctamente.' : 'Empleado reactivado correctamente.'); setAction(null); await refresh() }, onError: () => query.refetch() })
  const create = () => { if (!/^\S+@\S+\.\S+$/.test(form.email) || form.password.length < 6 || new TextEncoder().encode(form.password).length > 72) return setFormError('Usa un correo válido y una contraseña de 6 a 72 bytes.'); setFormError(''); createMutation.mutate() }
  const rows = (query.data?.admins || []).map((admin) => ({ id: admin.id, account: <div><p className="font-bold text-white">{admin.email}</p><p className="text-xs text-muted">ID {admin.id}</p></div>, role: admin.role, status: <StatusBadge status={admin.status} />, created: formatDateTime(admin.created_at), action: admin.role === 'SUPER_ADMIN' ? 'Protegido' : admin.status === 'ACTIVE' ? <Button className="min-h-9 px-3 py-1.5" variant="danger" onClick={() => { setSuccessMessage(''); setAction({ type: 'suspend', admin }); statusMutation.reset() }}><Ban size={15} aria-hidden="true" /> Suspender</Button> : <Button className="min-h-9 px-3 py-1.5" variant="secondary" onClick={() => { setSuccessMessage(''); setAction({ type: 'reactivate', admin }); statusMutation.reset() }}><RotateCcw size={15} aria-hidden="true" /> Reactivar</Button> }))
  return <AdminLayout><PageHeader eyebrow="Equipo interno" title="Administradores" subtitle="Sólo pueden crearse cuentas EMPLOYEE. Las cuentas SUPER_ADMIN no se crean ni suspenden desde la API." actions={<Button onClick={() => { setSuccessMessage(''); setForm({ email: '', password: '' }); setShowCreate(true); createMutation.reset() }}><Plus size={17} aria-hidden="true" /> Crear empleado</Button>} /><div className="mt-6 grid gap-3"><AdminSuccess message={successMessage} /><AdminError error={statusMutation.error} /></div><section className="mt-6">{query.isPending ? <CardSkeleton /> : query.isError ? <QueryErrorState error={query.error} onRetry={query.refetch} /> : <DataTable caption="Cuentas administrativas" columns={[{ key: 'account', label: 'Cuenta' }, { key: 'role', label: 'Rol' }, { key: 'status', label: 'Estado' }, { key: 'created', label: 'Creada' }, { key: 'action', label: 'Acción' }]} rows={rows} />}</section><ConfirmDialog open={showCreate} title="Crear cuenta EMPLOYEE" confirmLabel="Crear empleado" confirmLoading={createMutation.isPending} onClose={() => { setShowCreate(false); setForm((current) => ({ ...current, password: '' })) }} onConfirm={create}><div className="grid gap-4"><AdminError error={createMutation.error} /><FormField label="Correo" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /><FormField label="Contraseña temporal" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} error={formError} /></div></ConfirmDialog><ConfirmDialog open={Boolean(action)} title={action?.type === 'suspend' ? 'Suspender empleado' : 'Reactivar empleado'} confirmLabel={action?.type === 'suspend' ? 'Suspender cuenta' : 'Reactivar cuenta'} confirmLoading={statusMutation.isPending} onClose={() => setAction(null)} onConfirm={() => statusMutation.mutate()}><p>{action?.type === 'suspend' ? 'Se revocarán inmediatamente todas las sesiones activas de esta cuenta.' : 'La cuenta volverá a poder iniciar sesión con su rol EMPLOYEE.'}</p></ConfirmDialog></AdminLayout>
}
