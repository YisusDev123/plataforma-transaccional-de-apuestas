import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { RotateCcw, ShieldAlert } from 'lucide-react'
import { useAuth } from '../auth/useAuth.js'
import { kycApi } from './kyc-api.js'
import { kycFormSchema } from './kyc-schema.js'
import { Alert } from '../../shared/components/Alert.jsx'
import { Button } from '../../shared/components/Button.jsx'
import { FormField } from '../../shared/components/FormField.jsx'
import { SuccessFeedback } from '../../shared/components/SuccessFeedback.jsx'

function KycForm({ rejected = false }) {
  const { markKycPending, refreshProfile } = useAuth()
  const form = useForm({ resolver: zodResolver(kycFormSchema), defaultValues: { full_name: '', dni: '' } })
  const mutation = useMutation({
    mutationFn: kycApi.submit,
    onSuccess: () => {
      form.reset()
      markKycPending()
      refreshProfile().catch(() => undefined)
    },
  })
  const submit = form.handleSubmit((values) => mutation.mutate(values))
  return (
    <div className="surface-panel rounded-3xl p-5 sm:p-7">
      <div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-electric-500/15 text-electric-400">{rejected ? <RotateCcw size={21} aria-hidden="true" /> : <ShieldAlert size={21} aria-hidden="true" />}</span><div><h2 className="text-xl font-black text-white">{rejected ? 'Envía nuevamente tus datos' : 'Verifica tu identidad'}</h2><p className="mt-1 text-sm leading-6 text-muted">La revisión protege depósitos, retiros y la confirmación de apuestas; puedes explorar los sorteos antes de completarla.</p></div></div>
      {rejected && <div className="mt-5"><Alert title="La solicitud anterior no fue aprobada" variant="warning"><p>Revisa cuidadosamente tus datos antes de reenviarlos. Si necesitas ayuda, comunícate con soporte.</p></Alert></div>}
      {mutation.isError && <div className="mt-5"><Alert title="No pudimos enviar la información" variant="danger"><p>{mutation.error?.status >= 500 ? 'Ocurrió un problema inesperado. Intenta más tarde.' : mutation.error.message}</p>{mutation.error?.correlationId && <p className="mt-2 text-xs">Referencia: {mutation.error.correlationId}</p>}</Alert></div>}
      <form className="mt-6 grid gap-5" onSubmit={submit} noValidate>
        <FormField autoComplete="name" label="Nombre completo" error={form.formState.errors.full_name?.message} {...form.register('full_name')} />
        <FormField autoComplete="off" inputMode="numeric" label="Número de documento" hint="Solo dígitos. Después del envío podrás consultarlo como Cédula en los datos de tu cuenta." error={form.formState.errors.dni?.message} {...form.register('dni')} />
        <Button className="sm:justify-self-start" loading={mutation.isPending} type="submit">Enviar para revisión</Button>
      </form>
    </div>
  )
}

export function KycPanel({ status }) {
  const normalized = String(status || 'NO_KYC').toUpperCase()
  if (normalized === 'APPROVED') return <SuccessFeedback title="Identidad verificada" message="Tu identidad fue aprobada correctamente." />
  if (normalized === 'PENDING') return <SuccessFeedback title="Datos enviados correctamente" message="Recibimos tu información y la revisión está en proceso." />
  return <KycForm rejected={normalized === 'REJECTED'} />
}
