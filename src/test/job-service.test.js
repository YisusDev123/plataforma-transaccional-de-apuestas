import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { iniciarJobsService } from '../modules/jobs/job-service.js';

describe('jobsService', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('escanea estados una sola vez con la fecha de Costa Rica', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        const jobsSql = {
            escanearYActualizarEstados: jest.fn().mockResolvedValue({ abiertos: 2, cerrados: 3, incompletos: 0 })
        };
        const service = iniciarJobsService(jobsSql, {}, {});

        await service.procesarCambiosDeEstado();

        expect(jobsSql.escanearYActualizarEstados).toHaveBeenCalledTimes(1);
        expect(jobsSql.escanearYActualizarEstados).toHaveBeenCalledWith(
            expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
        );
    });

    test('usa límite y minutos de cierre desde draw_defaults', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        const connection = {
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn()
        };
        const jobsSql = {
            guardarOSobreescribirSorteo: jest.fn()
        };
        const pool = {
            getConnection: jest.fn().mockResolvedValue(connection)
        };
        const settingsService = {
            get: jest.fn().mockReturnValue({
                default_risk_limit: 9876,
                auto_close_minutes_before: 10
            })
        };
        const service = iniciarJobsService(jobsSql, pool, settingsService);

        await service.generarSorteosDelDia();

        const [firstConnection, firstDraw, appliedLimit] = jobsSql.guardarOSobreescribirSorteo.mock.calls[0];
        expect(firstConnection).toBe(connection);
        expect(appliedLimit).toBe(9876);
        expect(firstDraw.schedule_time).toBe('11:00:00');
        expect(firstDraw.close_at.endsWith('16:50:00')).toBe(true);
        expect(connection.commit).toHaveBeenCalledTimes(1);
        expect(connection.release).toHaveBeenCalledTimes(1);
    });
});
