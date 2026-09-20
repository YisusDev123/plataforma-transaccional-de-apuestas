import { z } from 'zod'

const MAX_PASSWORD_BYTES = 72
const utf8Length = (value) => new TextEncoder().encode(value).length

export const emailSchema = z.string()
  .trim()
  .min(1, 'Ingresa tu correo electrónico.')
  .max(254, 'El correo no puede superar 254 caracteres.')
  .email('Ingresa un correo electrónico válido.')
  .transform((value) => value.toLowerCase())

const loginPassword = z.string()
  .min(1, 'Ingresa tu contraseña.')
  .refine((value) => utf8Length(value) <= MAX_PASSWORD_BYTES, 'La contraseña no puede superar 72 bytes.')

const newPassword = loginPassword.min(6, 'La contraseña debe tener al menos 6 caracteres.')

function passwordsMatch(data, context) {
  if (data.password !== data.confirmPassword) {
    context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Las contraseñas no coinciden.' })
  }
}

export const loginFormSchema = z.object({ email: emailSchema, password: loginPassword })

export const registerFormSchema = z.object({
  email: emailSchema,
  password: newPassword,
  confirmPassword: z.string().min(1, 'Confirma tu contraseña.'),
}).superRefine(passwordsMatch)

export const verifyEmailFormSchema = z.object({
  email: emailSchema,
  verificationCode: z.string().trim().regex(/^\d{6}$/, 'Ingresa el código de 6 dígitos.'),
})

export const forgotPasswordFormSchema = z.object({ email: emailSchema })

export const resetPasswordFormSchema = z.object({
  email: emailSchema,
  resetCode: z.string().trim().regex(/^\d{6}$/, 'Ingresa el código de 6 dígitos.'),
  password: newPassword,
  confirmPassword: z.string().min(1, 'Confirma tu contraseña.'),
}).superRefine(passwordsMatch)

export function authErrorMessage(error, fallback = 'No fue posible completar la solicitud.') {
  if (error?.code === 'NETWORK_ERROR') return error.message
  if (error?.status === 429) return 'Has realizado demasiados intentos. Espera unos minutos antes de continuar.'
  if (error?.status === 503) return 'El servicio está ocupado temporalmente. Intenta nuevamente en unos segundos.'
  if (error?.status >= 500) return 'Ocurrió un problema inesperado. Intenta nuevamente más tarde.'
  return error?.message || fallback
}
