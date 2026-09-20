const BUSINESS_TIME_ZONE = 'America/Costa_Rica'

export function formatMoney(value) {
  const raw = String(value ?? '0').trim()
  const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?$/)
  if (!match) return '—'
  const [, sign, integer, decimal = ''] = match
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign ? '- ' : ''}₡${grouped},${decimal.padEnd(2, '0').slice(0, 2)}`
}

export function moneyToCents(value) {
  const match = String(value ?? '').trim().match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return null
  return BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'))
}

export function subtractMoney(minuend, subtrahend) {
  const left = moneyToCents(minuend)
  const right = moneyToCents(subtrahend)
  if (left == null || right == null || right > left) return null
  const cents = left - right
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: BUSINESS_TIME_ZONE,
  }).format(date)
}

export function formatDate(value) {
  if (!value) return '—'
  const calendarDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  const date = calendarDate
    ? new Date(`${calendarDate[1]}-${calendarDate[2]}-${calendarDate[3]}T12:00:00.000Z`)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-CR', {
    dateStyle: 'medium',
    timeZone: calendarDate ? 'UTC' : BUSINESS_TIME_ZONE,
  }).format(date)
}
