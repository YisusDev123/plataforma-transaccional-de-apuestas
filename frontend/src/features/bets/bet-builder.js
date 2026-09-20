import { amountForApi, amountSchema } from '../financial-intent/financial-schemas.js'
import { moneyToCents } from '../../shared/utils/formatters.js'

export function normalizeBetAmount(value) {
  return amountSchema.safeParse(value)
}

export function ticketTotalCents(items) {
  return items.reduce((total, item) => total + (moneyToCents(item.amount) || 0n), 0n)
}

export function centsToMoney(cents) {
    return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

export function calculatePotentialPayout(amount, multiplier) {
  const amountCents = moneyToCents(amount)
  const multiplierHundredths = moneyToCents(multiplier)
  if (amountCents == null || multiplierHundredths == null) return null
  return centsToMoney((amountCents * multiplierHundredths + 50n) / 100n)
}

export function canonicalBetPayload(items) {
  return [...items]
    .sort((left, right) => Number(left.drawId) - Number(right.drawId)
      || left.number.localeCompare(right.number))
    .map((item) => ({
      draw_id: Number(item.drawId),
      number_played: item.number,
      amount: amountForApi(item.amount),
    }))
}

export function validateTicket(items, { balance, maxTotal, minPerNumber, availability = new Map() }) {
  if (items.length === 0) return 'Agrega al menos una jugada al boleto.'
  if (items.length > 100) return 'Un boleto admite como máximo 100 jugadas.'

  const seen = new Set()
  for (const item of items) {
    const key = `${item.drawId}:${item.number}`
    if (seen.has(key)) return `El número ${item.number} está repetido en el mismo sorteo.`
    seen.add(key)

    const parsed = normalizeBetAmount(item.amount)
    if (!parsed.success) return `Revisa el monto del número ${item.number}: ${parsed.error.issues[0].message}`
    const amount = moneyToCents(parsed.data)
    if (amount < moneyToCents(minPerNumber)) return `El mínimo por número es ${minPerNumber}.`

    const current = availability.get(key)
    if (!current?.available) return `El número ${item.number} ya no está disponible.`
    if (amount > moneyToCents(current.remaining_amount)) return `El monto del número ${item.number} supera su disponibilidad actual.`
  }

  const total = ticketTotalCents(items)
  if (total > moneyToCents(maxTotal)) return `El total supera el máximo permitido de ${maxTotal}.`
  if (total > moneyToCents(balance)) return 'El saldo disponible no alcanza para este boleto.'
  return null
}
