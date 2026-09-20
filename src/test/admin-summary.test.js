import { describe, expect, jest, test } from '@jest/globals';
import { obtenerResumenOperativo } from '../modules/admin/admin-services.js';
import { iniciarBaseDeDatos } from '../shared/database/admin-sql.js';

describe('resumen operativo administrativo', () => {
    test('combina conteos de base con estado seguro del sistema', async () => {
        const database = {
            obtenerResumenOperativo: jest.fn().mockResolvedValue({
                pending_kyc: 2,
                pending_deposits: 3,
                pending_withdrawals: 4,
                closed_draws: 1
            })
        };
        const settings = {
            get: jest.fn().mockReturnValue({
                maintenance_mode: false,
                sales_enabled: true,
                message: 'Operación normal',
                internal_value: 'no debe exponerse'
            })
        };

        await expect(obtenerResumenOperativo(database, settings)).resolves.toEqual({
            pending_kyc: 2,
            pending_deposits: 3,
            pending_withdrawals: 4,
            closed_draws: 1,
            system_status: {
                maintenance_mode: false,
                sales_enabled: true,
                message: 'Operación normal'
            }
        });
    });

    test('normaliza conteos MySQL sin interpolar entrada', async () => {
        const pool = {
            query: jest.fn().mockResolvedValue([[{ pending_kyc: '2', pending_deposits: 0, pending_withdrawals: '4', closed_draws: 1 }]])
        };
        const database = iniciarBaseDeDatos(pool);
        await expect(database.obtenerResumenOperativo()).resolves.toEqual({
            pending_kyc: 2,
            pending_deposits: 0,
            pending_withdrawals: 4,
            closed_draws: 1
        });
        expect(pool.query.mock.calls[0]).toHaveLength(1);
    });
});
