import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { abandonIntent, clearFinancialIntents, getPendingIntent, prepareIntent } from './intent-store.js'

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('crypto', { subtle: webcrypto.subtle, randomUUID: () => '11111111-1111-4111-8111-111111111111' })
})

afterEach(() => vi.unstubAllGlobals())

describe('intenciones financieras', () => {
  test('persiste únicamente identificador y huella, no el payload', async () => {
    const intent = await prepareIntent('deposit', { amount: '100.00', referenceNumber: 'SECRETA-1' })
    expect(intent.requestId).toBe('11111111-1111-4111-8111-111111111111')
    const stored = JSON.stringify(sessionStorage)
    expect(stored).not.toContain('100.00')
    expect(stored).not.toContain('SECRETA-1')
    expect(getPendingIntent('deposit').payloadFingerprint).toHaveLength(64)
  })

  test('reutiliza la intención para el mismo payload', async () => {
    const first = await prepareIntent('withdrawal', { amount: '50.00', destinationAccount: 'CUENTA' })
    const second = await prepareIntent('withdrawal', { amount: '50.00', destinationAccount: 'CUENTA' })
    expect(second.requestId).toBe(first.requestId)
  })

  test('impide sustituir silenciosamente una intención pendiente', async () => {
    await prepareIntent('deposit', { amount: '100.00', referenceNumber: 'A' })
    await expect(prepareIntent('deposit', { amount: '200.00', referenceNumber: 'B' }))
      .rejects.toMatchObject({ code: 'PENDING_INTENT_PAYLOAD_MISMATCH' })
  })

  test('puede descartar una intención o limpiar todas al cerrar sesión', async () => {
    await prepareIntent('deposit', { amount: '100.00', referenceNumber: 'A' })
    abandonIntent('deposit')
    expect(getPendingIntent('deposit')).toBeNull()
    await prepareIntent('withdrawal', { amount: '50.00', destinationAccount: 'B' })
    clearFinancialIntents()
    expect(getPendingIntent('withdrawal')).toBeNull()
  })
})
