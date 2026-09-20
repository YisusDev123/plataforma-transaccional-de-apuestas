import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Button, ButtonLink } from '../../../shared/components/Button.jsx'
import { FormField } from '../../../shared/components/FormField.jsx'
import { authApi } from '../auth-api.js'
import { forgotPasswordFormSchema } from '../auth-schemas.js'
import { AuthError, AuthSuccess } from '../components/AuthFeedback.jsx'
import { AuthPageShell } from '../components/AuthPageShell.jsx'

export function ForgotPasswordPage() {
  const [submittedEmail, setSubmittedEmail] = useState('')
  const form = useForm({ resolver: zodResolver(forgotPasswordFormSchema), defaultValues: { email: '' } })
  const mutation = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (_, values) => setSubmittedEmail(values.email),
    onError: (error, values) => {
      if (error.status === 404) setSubmittedEmail(values.email)
    },
  })

  if (submittedEmail) {
    return (
      <AuthPageShell eyebrow="Revisa tu correo" title="Continúa con tu código" subtitle="Por seguridad mostramos la misma respuesta aunque el correo no esté registrado.">
        <AuthSuccess title="Solicitud recibida"><p>Si existe una cuenta válida, se generó un código para cambiar la contraseña.</p></AuthSuccess>
        <ButtonLink className="mt-6 w-full" to={`/restablecer-contrasena?email=${encodeURIComponent(submittedEmail)}`}>Ingresar código</ButtonLink>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell eyebrow="Recuperación" title="¿Olvidaste tu contraseña?" subtitle="Ingresa tu correo y, si existe una cuenta válida, podrás continuar con un código de recuperación.">
      <form className="grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <AuthError error={mutation.error?.status === 404 ? null : mutation.error} />
        <FormField label="Correo electrónico" type="email" autoComplete="email" placeholder="tu@correo.com" error={form.formState.errors.email?.message} {...form.register('email')} />
        <Button className="w-full" loading={mutation.isPending} type="submit"><KeyRound size={18} aria-hidden="true" /> Solicitar código</Button>
      </form>
      <p className="mt-6 text-center text-sm"><Link className="font-bold text-[#c8cde0] hover:text-white" to="/login">Volver al acceso</Link></p>
    </AuthPageShell>
  )
}
