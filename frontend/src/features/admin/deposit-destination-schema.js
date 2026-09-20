import { z } from 'zod'

const accountHolder = z.string()
  .trim()
  .min(3, 'El nombre del titular debe tener al menos 3 caracteres.')
  .max(255, 'El nombre del titular no puede superar 255 caracteres.')
  .refine((value) => !/[<>]/.test(value) && ![...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || (code >= 127 && code <= 159)
  }), 'El nombre contiene caracteres no permitidos.')
  .transform((value) => value.normalize('NFC'))

const normalizedValue = z.string().trim().transform((value) => value.replace(/[\s-]/g, '').toUpperCase())

export const bankDestinationSchema = z.object({
  destinationValue: normalizedValue.pipe(z.string().regex(/^CR\d{20}$/, 'Ingresa un IBAN de Costa Rica con CR y 20 dígitos.')),
  accountHolder,
})

export const sinpeDestinationSchema = z.object({
  destinationValue: normalizedValue.pipe(z.string().regex(/^\d{8}$/, 'Ingresa un número de SINPE Móvil de 8 dígitos.')),
  accountHolder,
})
