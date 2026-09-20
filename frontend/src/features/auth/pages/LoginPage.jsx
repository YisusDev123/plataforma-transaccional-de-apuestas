import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../../shared/components/Button.jsx'
import { FormField } from '../../../shared/components/FormField.jsx'
import { useAuth } from '../useAuth.js'
import { loginFormSchema } from '../auth-schemas.js'
import { AuthError } from '../components/AuthFeedback.jsx'
import { AuthPageShell } from '../components/AuthPageShell.jsx'
import { PasswordField } from '../components/PasswordField.jsx'
import { safePlayerReturnTo } from '../auth-navigation.js'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const form = useForm({ resolver: zodResolver(loginFormSchema), defaultValues: { email: '', password: '' } })
  const mutation = useMutation({ mutationFn: login, onSuccess: () => navigate(safePlayerReturnTo(searchParams.get('returnTo')), { replace: true }) })
  const email = useWatch({ control: form.control, name: 'email' })

  return (
    <AuthPageShell eyebrow="Bienvenido" title="Inicia sesión" subtitle="Ingresa con tu correo verificado para acceder a tu área de jugador.">
      <form className="grid gap-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <AuthError error={mutation.error} fallback="Revisa tus credenciales e intenta nuevamente." />
        <FormField label="Correo electrónico" type="email" autoComplete="email" placeholder="tu@correo.com" error={form.formState.errors.email?.message} {...form.register('email')} />
        <PasswordField label="Contraseña" autoComplete="current-password" error={form.formState.errors.password?.message} {...form.register('password')} />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link className="font-bold text-electric-400 hover:text-electric-300" to={`/verificar-correo${email ? `?email=${encodeURIComponent(email)}` : ''}`}>Verificar correo</Link>
          <Link className="font-bold text-[#c8cde0] hover:text-white" to="/olvide-contrasena">Olvidé mi contraseña</Link>
        </div>
        <Button className="w-full" loading={mutation.isPending} type="submit">Entrar <ArrowRight size={18} aria-hidden="true" /></Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">¿Aún no tienes cuenta? <Link className="font-bold text-jade-400 hover:text-[#63efc1]" to="/registro">Regístrate</Link></p>
    </AuthPageShell>
  )
}
