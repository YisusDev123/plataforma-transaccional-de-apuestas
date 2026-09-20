import { z } from 'zod'

const fullNamePattern = /^(?=.*\p{L})[\p{L}\p{M} .'-]+$/u

export const kycFormSchema = z.object({
  full_name: z.string()
    .trim()
    .min(3, 'El nombre completo debe tener al menos 3 caracteres.')
    .max(255, 'El nombre completo no puede superar 255 caracteres.')
    .regex(fullNamePattern, 'Usa únicamente letras, espacios, apóstrofes, puntos y guiones.')
    .transform((value) => value.normalize('NFC')),
  dni: z.string()
    .trim()
    .min(5, 'El documento debe tener al menos 5 dígitos.')
    .regex(/^\d+$/, 'El documento solo puede contener números.'),
})
