import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, ButtonLink } from '../../../shared/components/Button.jsx'
import { FormField } from '../../../shared/components/FormField.jsx'
import { authApi } from '../auth-api.js'
import { verifyEmailFormSchema } from '../auth-schemas.js'
import { AuthError, AuthSuccess } from '../components/AuthFeedback.jsx'
import { AuthPageShell } from '../components/AuthPageShell.jsx'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const form = useForm({ resolver: zodResolver(verifyEmailFormSchema), defaultValues: { email: searchParams.get('email') || '', verificationCode: '' } })
  const verifyMutation = useMutation({ mutationFn: authApi.verifyEmail })
  const resendMutation = useMutation({ mutationFn: (email) => authApi.resendVerification({ email }) })
  const email = useWatch({ control: form.control, name: 'email' })

  if (verifyMutation.isSuccess) {
    return (
      <AuthPageShell eyebrow="Correo confirmado" title="Tu cuenta está verificada" subtitle="Ya puedes iniciar sesión de forma segura.">
        <AuthSuccess title="Verificación completada"><p>El correo quedó confirmado correctamente.</p></AuthSuccess>
        <ButtonLink className="mt-6 w-full" to="/login">Ir a iniciar sesión</ButtonLink>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell eyebrow="Confirma tu correo" title="Ingresa el código" subtitle="Usa el código de seis dígitos asociado a tu registro.">
      <form className="grid gap-5" onSubmit={form.handleSubmit((values) => verifyMutation.mutate(values))} noValidate>
        <AuthError error={verifyMutation.error} />
        {resendMutation.isSuccess && <AuthSuccess title="Código generado"><p>Se generó un nuevo código de verificación.</p></AuthSuccess>}
        <AuthError error={resendMutation.error} />
        <FormField label="Correo electrónico" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register('email')} />
        <FormField label="Código de verificación" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" error={form.formState.errors.verificationCode?.message} {...form.register('verificationCode')} />
        <Button className="w-full" loading={verifyMutation.isPending} type="submit"><MailCheck size={18} aria-hidden="true" /> Verificar correo</Button>
      </form>
      <div className="mt-6 flex flex-col items-center gap-3 text-sm">
        <Button variant="ghost" disabled={!email || resendMutation.isPending} loading={resendMutation.isPending} onClick={() => resendMutation.mutate(email)}>Reenviar código</Button>
        <Link className="font-bold text-[#c8cde0] hover:text-white" to="/login">Volver al acceso</Link>
      </div>
    </AuthPageShell>
  )
}
