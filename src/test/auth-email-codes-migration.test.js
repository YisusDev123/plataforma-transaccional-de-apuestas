import { describe, expect, jest, test } from '@jest/globals'
import { applyAuthEmailCodesMigration } from '../shared/database/auth-email-codes-migration.js'

describe('migración de códigos de correo', () => {
    test('amplía columnas cortas y expira códigos heredados', async () => {
        const connection = {
            query: jest.fn(async (sql, params) => {
                if (sql.includes('information_schema.columns')) {
                    return [[{ maximumLength: params[0] === 'email_verifications' ? 10 : 6 }]]
                }
                if (sql.includes('ALTER TABLE')) return [{ affectedRows: 0 }]
                if (sql.includes('UPDATE')) return [{ affectedRows: 2 }]
                throw new Error(`Consulta inesperada: ${sql}`)
            })
        }

        const result = await applyAuthEmailCodesMigration(connection)
        expect(result.changed).toBe(true)
        expect(connection.query.mock.calls.filter(([sql]) => sql.includes('ALTER TABLE'))).toHaveLength(2)
        expect(connection.query.mock.calls.filter(([sql]) => sql.includes("status = 'EXPIRED'"))).toHaveLength(2)
    })

    test('es idempotente cuando el esquema y los registros ya son seguros', async () => {
        const connection = {
            query: jest.fn(async sql => sql.includes('information_schema.columns')
                ? [[{ maximumLength: 64 }]]
                : [{ affectedRows: 0 }])
        }

        await expect(applyAuthEmailCodesMigration(connection)).resolves.toEqual({ changed: false, actions: [] })
        expect(connection.query.mock.calls.some(([sql]) => sql.includes('ALTER TABLE'))).toBe(false)
    })
})
