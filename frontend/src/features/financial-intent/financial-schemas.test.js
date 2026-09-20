import { describe, expect, test } from 'vitest'
import { amountForApi, depositFormSchema, withdrawalFormSchema } from './financial-schemas.js'

describe('formularios financieros', () => {
  test('normaliza a dos decimales y convierte solo en el borde API', () => {
    const parsed = depositFormSchema.parse({ amount: '100.5', referenceNumber: ' REF-1 ', destinationId: '7' })
    expect(parsed).toEqual({ amount: '100.50', referenceNumber: 'REF-1', destinationId: 7 })
    expect(amountForApi(parsed.amount)).toBe(100.5)
  })

  test.each(['0', '-1', '1.999', '1e3', 'texto'])('rechaza monto inválido %s', (amount) => {
    expect(depositFormSchema.safeParse({ amount, referenceNumber: 'REF', destinationId: 1 }).success).toBe(false)
  })

  test('rechaza markup y controles en datos persistentes', () => {
    expect(depositFormSchema.safeParse({ amount: '10', referenceNumber: '<b>REF</b>', destinationId: 1 }).success).toBe(false)
    expect(withdrawalFormSchema.safeParse({ amount: '10', destinationAccount: 'CTA\nDOS', destinationAccountHolder: 'Persona Titular' }).success).toBe(false)
    expect(withdrawalFormSchema.safeParse({ amount: '10', destinationAccount: '88887777', destinationAccountHolder: '' }).success).toBe(false)
  })

  test('exige un destino de depósito válido', () => {
    expect(depositFormSchema.safeParse({ amount: '10', referenceNumber: 'REF', destinationId: '' }).success).toBe(false)
  })
})
