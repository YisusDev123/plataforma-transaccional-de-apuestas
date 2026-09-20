import { z } from 'zod'

const MAX_SAFE_MONEY = Math.floor(Number.MAX_SAFE_INTEGER / 100)
const plainText = (label) => z.string()
  .trim()
  .min(1, `${label} es obligatorio.`)
  .max(255, `${label} no puede superar 255 caracteres.`)
  .refine((value) => !/[<>]/.test(value) && ![...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || (code >= 127 && code <= 159)
  }), `${label} contiene caracteres no permitidos.`)
  .transform((value) => value.normalize('NFC'))

export const amountSchema = z.string()
  .trim()
  .min(1, 'Ingresa un monto.')
  .regex(/^\d+(?:\.\d{1,2})?$/, 'Usa un monto positivo con máximo dos decimales.')
  .refine((value) => Number(value) > 0, 'El monto debe ser mayor a cero.')
  .refine((value) => Number(value) <= MAX_SAFE_MONEY, 'El monto supera el máximo permitido.')
  .transform((value) => {
    const [whole, decimal = ''] = value.split('.')
    return `${whole}.${decimal.padEnd(2, '0')}`
  })

export const depositFormSchema = z.object({
  amount: amountSchema,
  referenceNumber: plainText('El número de referencia'),
  destinationId: z.coerce.number().int().positive('Selecciona el destino que utilizaste.'),
})

export const withdrawalFormSchema = z.object({
  amount: amountSchema,
  destinationAccount: plainText('La cuenta destino o SINPE Móvil'),
  destinationAccountHolder: plainText('El nombre del titular'),
})

export function amountForApi(value) {
  return Number(value)
}
