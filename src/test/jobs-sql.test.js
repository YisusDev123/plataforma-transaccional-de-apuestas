import { describe, expect, jest, test } from '@jest/globals';
import { iniciarBaseDeDatosJobs } from '../shared/database/jobs-sql.js';

describe('repositorio de jobs automáticos', () => {
    test('crea un sorteo nuevo junto con exactamente 100 límites', async () => {
        const connection = {
            execute: jest.fn()
                .mockResolvedValueOnce([[]])
                .mockResolvedValueOnce([{ insertId: 55 }]),
            query: jest.fn().mockResolvedValue([{ affectedRows: 100 }])
        };
        const jobsSql = iniciarBaseDeDatosJobs({});

        await jobsSql.guardarOSobreescribirSorteo(connection, {
            lottery: 'NICA',
            schedule_time: '11:00:00',
            modality: 'NORMAL',
            draw_date: '2026-08-23',
            open_at: '2026-08-23 06:00:00',
            close_at: '2026-08-23 16:55:00'
        }, 3000);

        const [, parameters] = connection.query.mock.calls[0];
        expect(parameters[0]).toHaveLength(100);
        expect(parameters[0][0]).toEqual([55, '00', 3000]);
        expect(parameters[0][99]).toEqual([55, '99', 3000]);
    });

    test('no sobrescribe un sorteo existente', async () => {
        const connection = {
            execute: jest.fn().mockResolvedValue([[{ id: 10, status: 'CLOSED' }]]),
            query: jest.fn()
        };
        const jobsSql = iniciarBaseDeDatosJobs({});

        await jobsSql.guardarOSobreescribirSorteo(connection, {
            lottery: 'NICA',
            schedule_time: '11:00:00',
            modality: 'NORMAL',
            draw_date: '2026-08-23'
        }, 3000);

        expect(connection.execute).toHaveBeenCalledTimes(1);
        expect(connection.query).not.toHaveBeenCalled();
    });

    test('solo abre sorteos con 100 límites y reporta matrices incompletas', async () => {
        const pool = {
            query: jest.fn()
                .mockResolvedValueOnce([{ affectedRows: 1 }])
                .mockResolvedValueOnce([{ affectedRows: 1 }])
                .mockResolvedValueOnce([[{ abiertosTotales: 2, cerradosTotales: 3 }]])
                .mockResolvedValueOnce([[{ total: 1 }]])
        };
        const jobsSql = iniciarBaseDeDatosJobs(pool);

        const result = await jobsSql.escanearYActualizarEstados('2026-08-23');

        const openQuery = pool.query.mock.calls[0][0];
        expect(openQuery).toContain('FROM number_limits');
        expect(openQuery).toContain('= 100');
        expect(result).toEqual({ abiertos: 2, cerrados: 3, incompletos: 1 });
    });
});
