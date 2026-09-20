import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { iniciarSystemAvailabilityMiddleware } from '../shared/middleware/system-availability.js';
import { globalErrorHandler } from '../shared/error/globalErrors.js';
import { logger } from '../shared/error/winston.js';

function crearSettingsService(systemStatus) {
    return {
        get: jest.fn().mockReturnValue(systemStatus)
    };
}

describe('disponibilidad operativa del sistema', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('permite solicitudes cuando mantenimiento está desactivado', () => {
        const settingsService = crearSettingsService({
            maintenance_mode: false,
            sales_enabled: true,
            message: ''
        });
        const { maintenanceGuard } = iniciarSystemAvailabilityMiddleware(settingsService);
        const next = jest.fn();

        maintenanceGuard({}, {}, next);

        expect(next).toHaveBeenCalledWith();
    });

    test('bloquea usuarios y EMPLOYEE durante mantenimiento con el mensaje configurado', () => {
        const settingsService = crearSettingsService({
            maintenance_mode: true,
            sales_enabled: true,
            message: 'Mantenimiento programado.'
        });
        const { maintenanceGuard } = iniciarSystemAvailabilityMiddleware(settingsService);

        for (const req of [{}, { admin: { role: 'EMPLOYEE' } }]) {
            const next = jest.fn();
            maintenanceGuard(req, {}, next);

            expect(next).toHaveBeenCalledWith(expect.objectContaining({
                statusCode: 503,
                publicCode: 'MAINTENANCE_MODE',
                message: 'Mantenimiento programado.'
            }));
        }
    });

    test('permite a SUPER_ADMIN operar durante mantenimiento', () => {
        const settingsService = crearSettingsService({
            maintenance_mode: true,
            sales_enabled: false,
            message: ''
        });
        const { maintenanceGuard } = iniciarSystemAvailabilityMiddleware(settingsService);
        const next = jest.fn();

        maintenanceGuard({ admin: { role: 'SUPER_ADMIN' } }, {}, next);

        expect(next).toHaveBeenCalledWith();
    });

    test('usa un mensaje seguro por defecto durante mantenimiento', () => {
        const settingsService = crearSettingsService({
            maintenance_mode: true,
            sales_enabled: true,
            message: '   '
        });
        const { maintenanceGuard } = iniciarSystemAvailabilityMiddleware(settingsService);
        const next = jest.fn();

        maintenanceGuard({}, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            message: 'El sistema se encuentra temporalmente en mantenimiento.'
        }));
    });

    test('falla de forma segura cuando system_status no está disponible', () => {
        const settingsService = crearSettingsService(undefined);
        const { maintenanceGuard } = iniciarSystemAvailabilityMiddleware(settingsService);
        const next = jest.fn();

        maintenanceGuard({}, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 503,
            publicCode: 'SYSTEM_STATUS_UNAVAILABLE'
        }));
    });

    test('salesGuard bloquea únicamente cuando las ventas están deshabilitadas', () => {
        const disabledService = crearSettingsService({
            maintenance_mode: false,
            sales_enabled: false,
            message: ''
        });
        const enabledService = crearSettingsService({
            maintenance_mode: false,
            sales_enabled: true,
            message: ''
        });
        const blockedNext = jest.fn();
        const allowedNext = jest.fn();

        iniciarSystemAvailabilityMiddleware(disabledService).salesGuard({}, {}, blockedNext);
        iniciarSystemAvailabilityMiddleware(enabledService).salesGuard({}, {}, allowedNext);

        expect(blockedNext).toHaveBeenCalledWith(expect.objectContaining({
            statusCode: 503,
            publicCode: 'SALES_DISABLED'
        }));
        expect(allowedNext).toHaveBeenCalledWith();
    });

    test('el manejador global expone solo el código operacional público', () => {
        jest.spyOn(logger, 'warn').mockImplementation(() => {});
        const error = new Error('Mantenimiento programado.');
        error.statusCode = 503;
        error.publicCode = 'MAINTENANCE_MODE';
        error.code = 'ER_INTERNAL_DATABASE_CODE';
        const req = {
            originalUrl: '/wallet/balance',
            method: 'GET',
            ip: '127.0.0.1'
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        globalErrorHandler(error, req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            code: 'MAINTENANCE_MODE',
            message: 'Mantenimiento programado.'
        });
        expect(res.json.mock.calls[0][0]).not.toHaveProperty('errorCode');
        expect(res.json.mock.calls[0][0]).not.toHaveProperty('code', 'ER_INTERNAL_DATABASE_CODE');
    });
});
