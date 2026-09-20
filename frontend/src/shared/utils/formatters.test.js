import { describe, expect, test } from 'vitest'
import { formatDate, formatMoney } from './formatters.js'

describe('formatMoney', () => {
  test('formatea strings decimales sin alterar centavos', () => {
    expect(formatMoney('1234567.05')).toBe('₡1.234.567,05')
  })

  test('conserva el signo de débitos', () => {
    expect(formatMoney('-10.50')).toBe('- ₡10,50')
  })

  test('no inventa un monto cuando el contrato es inválido', () => {
    expect(formatMoney('sin-monto')).toBe('—')
  })
})

describe('formatDate', () => {
  test('conserva la fecha calendario oficial del sorteo', () => {
    expect(formatDate('2026-09-01T00:00:00.000Z')).toContain('1 sept 2026')
  })
})
