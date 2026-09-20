import { describe, expect, test } from 'vitest'
import { authErrorMessage, loginFormSchema, registerFormSchema, resetPasswordFormSchema, verifyEmailFormSchema } from './auth-schemas.js'
import { safePlayerReturnTo } from './auth-navigation.js'

describe('schemas de autenticación', () => {
  test('normaliza el correo y acepta una contraseña válida', () => {
    expect(loginFormSchema.parse({ email: '  Usuario@Ejemplo.COM ', password: 'secreto' })).toEqual({
      email: 'usuario@ejemplo.com',
      password: 'secreto',
    })
  })

  test('rechaza contraseñas nuevas cortas, distintas o mayores a 72 bytes', () => {
    expect(registerFormSchema.safeParse({ email: 'a@example.com', password: '12345', confirmPassword: '12345' }).success).toBe(false)
    expect(registerFormSchema.safeParse({ email: 'a@example.com', password: 'secreto', confirmPassword: 'distinta' }).success).toBe(false)
    const oversized = 'á'.repeat(37)
    expect(registerFormSchema.safeParse({ email: 'a@example.com', password: oversized, confirmPassword: oversized }).success).toBe(false)
  })

  test('exige códigos de exactamente seis dígitos', () => {
    expect(verifyEmailFormSchema.safeParse({ email: 'a@example.com', verificationCode: '123456' }).success).toBe(true)
    expect(verifyEmailFormSchema.safeParse({ email: 'a@example.com', verificationCode: '12345a' }).success).toBe(false)
    expect(resetPasswordFormSchema.safeParse({ email: 'a@example.com', resetCode: '123', password: 'secreto', confirmPassword: 'secreto' }).success).toBe(false)
  })

  test('traduce errores operacionales y bloquea retornos fuera del área de jugador', () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/demasiados intentos/i)
    expect(authErrorMessage({ status: 503 })).toMatch(/ocupado temporalmente/i)
    expect(safePlayerReturnTo('/app/tickets?page=2')).toBe('/app/tickets?page=2')
    expect(safePlayerReturnTo('//evil.example')).toBe('/app')
    expect(safePlayerReturnTo('/admin')).toBe('/app')
  })
})
