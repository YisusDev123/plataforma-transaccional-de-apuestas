import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../../shared/components/Button.jsx'
import { FormField } from '../../../shared/components/FormField.jsx'
import { authApi } from '../auth-api.js'
import { registerFormSchema } from '../auth-schemas.js'
import { AuthError } from '../components/AuthFeedback.jsx'
import { AuthPageShell } from '../components/AuthPageShell.jsx'
import { PasswordField } from '../components/PasswordField.jsx'

export function RegisterPage() {
  const navigate = useNavigate()
  const form = useForm({ resolver: zodResolver(registerFormSchema), defaultValues: { email: '', password: '', confirmPassword: '' } })
  const mutation = useMutation({
    mutationFn: ({ email, password }) => authApi.register({ email, password }),
    onSuccess: (_, variables) => navigate(`/verificar-correo?email=${encodeURIComponent(variables.email)}`, { replace: true }),
  })

  return (
    <AuthPageShell eyebrow="Nueva cuenta" title="Crea tu acceso" subtitle="Primero registramos tu correo. Después deberás validarlo con un código de seis dígitos.">
      <form className="grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <AuthError error={mutation.error} />
        <FormField label="Correo electrónico" type="email" autoComplete="email" placeholder="tu@correo.com" error={form.formState.errors.email?.message} {...form.register('email')} />
        <PasswordField label="Contraseña" autoComplete="new-password" hint="Mínimo 6 caracteres y máximo 72 bytes." error={form.formState.errors.password?.message} {...form.register('password')} />
        <PasswordField label="Confirmar contraseña" autoComplete="new-password" error={form.formState.errors.confirmPassword?.message} {...form.register('confirmPassword')} />
        <Button className="w-full" loading={mutation.isPending} type="submit">Continuar <ArrowRight size={18} aria-hidden="true" /></Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">¿Ya tienes cuenta? <Link className="font-bold text-jade-400" to="/login">Inicia sesión</Link></p>
    </AuthPageShell>
  )
}
