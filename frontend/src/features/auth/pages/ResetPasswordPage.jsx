import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, ButtonLink } from '../../../shared/components/Button.jsx'
import { FormField } from '../../../shared/components/FormField.jsx'
import { authApi } from '../auth-api.js'
import { resetPasswordFormSchema } from '../auth-schemas.js'
import { AuthError, AuthSuccess } from '../components/AuthFeedback.jsx'
import { AuthPageShell } from '../components/AuthPageShell.jsx'
import { PasswordField } from '../components/PasswordField.jsx'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const form = useForm({ resolver: zodResolver(resetPasswordFormSchema), defaultValues: { email: searchParams.get('email') || '', resetCode: '', password: '', confirmPassword: '' } })
  const mutation = useMutation({ mutationFn: ({ email, resetCode, password }) => authApi.resetPassword({ email, resetCode, newPassword: password }) })

  if (mutation.isSuccess) {
    return (
      <AuthPageShell eyebrow="Contraseña actualizada" title="Tu acceso fue restablecido" subtitle="Cerramos tus sesiones anteriores para proteger tu cuenta.">
        <AuthSuccess><p>Ya puedes iniciar sesión con tu nueva contraseña.</p></AuthSuccess>
        <ButtonLink className="mt-6 w-full" to="/login">Iniciar sesión</ButtonLink>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell eyebrow="Nuevo acceso" title="Cambia tu contraseña" subtitle="Ingresa el código recibido y define una contraseña nueva.">
      <form className="grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <AuthError error={mutation.error} />
        <FormField label="Correo electrónico" type="email" autoComplete="email" error={form.formState.errors.email?.message} {...form.register('email')} />
        <FormField label="Código de recuperación" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" error={form.formState.errors.resetCode?.message} {...form.register('resetCode')} />
        <PasswordField label="Nueva contraseña" autoComplete="new-password" error={form.formState.errors.password?.message} {...form.register('password')} />
        <PasswordField label="Confirmar contraseña" autoComplete="new-password" error={form.formState.errors.confirmPassword?.message} {...form.register('confirmPassword')} />
        <Button className="w-full" loading={mutation.isPending} type="submit"><ShieldCheck size={18} aria-hidden="true" /> Actualizar contraseña</Button>
      </form>
      <p className="mt-6 text-center text-sm"><Link className="font-bold text-[#c8cde0] hover:text-white" to="/login">Volver al acceso</Link></p>
    </AuthPageShell>
  )
}
