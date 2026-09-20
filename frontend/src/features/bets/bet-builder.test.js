import { describe, expect, test } from 'vitest'
import { canonicalBetPayload, centsToMoney, ticketTotalCents, validateTicket } from './bet-builder.js'

const availability = new Map([
  ['1:05', { number: '05', remaining_amount: '1000.00', available: true }],
  ['2:00', { number: '00', remaining_amount: '20.00', available: true }],
])

describe('constructor exacto de apuestas', () => {
  test('suma centavos sin punto flotante y conserva el número 00', () => {
    const items = [
      { drawId: 2, number: '00', amount: '10.10' },
      { drawId: 1, number: '05', amount: '20.20' },
    ]
    expect(ticketTotalCents(items)).toBe(3030n)
    expect(centsToMoney(ticketTotalCents(items))).toBe('30.30')
    expect(canonicalBetPayload(items)).toEqual([
      { draw_id: 1, number_played: '05', amount: 20.2 },
      { draw_id: 2, number_played: '00', amount: 10.1 },
    ])
  })

  test('acepta un boleto válido dentro de saldo, reglas y disponibilidad', () => {
    expect(validateTicket([
      { drawId: 1, number: '05', amount: '20.00' },
      { drawId: 2, number: '00', amount: '10.00' },
    ], { balance: '100.00', maxTotal: '80.00', minPerNumber: '10.00', availability })).toBeNull()
  })

  test.each([
    [[{ drawId: 1, number: '05', amount: '9.99' }], 'mínimo'],
    [[{ drawId: 2, number: '00', amount: '20.01' }], 'disponibilidad'],
    [[{ drawId: 1, number: '05', amount: '60.00' }, { drawId: 2, number: '00', amount: '20.00' }], 'saldo'],
    [[{ drawId: 1, number: '05', amount: '90.00' }], 'máximo'],
  ])('rechaza reglas financieras incumplidas', (items, expected) => {
    expect(validateTicket(items, {
      balance: '70.00', maxTotal: '80.00', minPerNumber: '10.00', availability,
    })).toMatch(new RegExp(expected, 'i'))
  })

  test('rechaza duplicados y números agotados', () => {
    expect(validateTicket([
      { drawId: 1, number: '05', amount: '10.00' },
      { drawId: 1, number: '05', amount: '10.00' },
    ], { balance: '100.00', maxTotal: '100.00', minPerNumber: '10.00', availability })).toMatch(/repetido/i)

    const exhausted = new Map([['1:05', { number: '05', remaining_amount: '0.00', available: false }]])
    expect(validateTicket([{ drawId: 1, number: '05', amount: '10.00' }], {
      balance: '100.00', maxTotal: '100.00', minPerNumber: '10.00', availability: exhausted,
    })).toMatch(/no está disponible/i)
  })
})
