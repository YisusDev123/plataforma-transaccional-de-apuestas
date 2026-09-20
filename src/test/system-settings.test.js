import { describe, expect, jest, test } from '@jest/globals';
import { settingsBodySchemas } from '../schemas/setting-schema.js';
import { createBetService } from '../modules/bets/bet-service.js';
import { iniciarSettingsService } from '../modules/settings/setting-services.js';

describe('actualización parcial de configuraciones', () => {
    test('system_status acepta un solo campo y rechaza un objeto vacío', () => {
        const partialResult = settingsBodySchemas.system_status.validate({
            maintenance_mode: true
        });
        const emptyResult = settingsBodySchemas.system_status.validate({});

        expect(partialResult.error).toBeUndefined();
        expect(partialResult.value).toEqual({ maintenance_mode: true });
        expect(emptyResult.error).toBeDefined();
    });

    test('las demás reglas conservan la semántica parcial de PATCH', () => {
        const result = settingsBodySchemas.financial_rules.validate({
            max_ticket_total: 45000
        });

        expect(result.error).toBeUndefined();
        expect(result.value).toEqual({ max_ticket_total: 45000 });
    });

    test('el cierre anticipado sólo admite enteros entre 10 y 20 minutos', () => {
        expect(settingsBodySchemas.draw_defaults.validate({ auto_close_minutes_before: 10 }).error).toBeUndefined();
        expect(settingsBodySchemas.draw_defaults.validate({ auto_close_minutes_before: 20 }).error).toBeUndefined();
        expect(settingsBodySchemas.draw_defaults.validate({ auto_close_minutes_before: 9 }).error).toBeDefined();
        expect(settingsBodySchemas.draw_defaults.validate({ auto_close_minutes_before: 21 }).error).toBeDefined();
    });

    test('mantiene la caché anterior cuando la transacción de draw_defaults falla', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        const conflict = Object.assign(new Error('Hay sorteos abiertos'), {
            statusCode: 409, publicCode: 'OPEN_DRAWS_PREVENT_CLOSE_RULE_CHANGE'
        });
        const settingsSql = {
            getAllSettings: jest.fn().mockResolvedValue([{
                setting_key: 'draw_defaults',
                setting_value: JSON.stringify({ default_risk_limit: 3000, auto_close_minutes_before: 10 })
            }]),
            updateDrawDefaultsConTransaccion: jest.fn().mockRejectedValue(conflict)
        };
        const service = iniciarSettingsService(settingsSql);
        await service.loadCache();

        await expect(service.update('draw_defaults', { auto_close_minutes_before: 15 }))
            .rejects.toBe(conflict);
        expect(service.get('draw_defaults')).toEqual({ default_risk_limit: 3000, auto_close_minutes_before: 10 });
    });

    test('withdraws_rules no acepta aprobación automática', () => {
        const validResult = settingsBodySchemas.withdraws_rules.validate({
            min_withdrawal: 500
        });
        const automaticResult = settingsBodySchemas.withdraws_rules.validate({
            auto_approve_withdrawals: true
        });

        expect(validResult.error).toBeUndefined();
        expect(automaticResult.error).toBeDefined();
    });

    test('el servicio fusiona el campo parcial sin sobrescribir los demás', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        const settingsSql = {
            getAllSettings: jest.fn().mockResolvedValue([{
                setting_key: 'system_status',
                setting_value: JSON.stringify({
                    maintenance_mode: false,
                    sales_enabled: true,
                    message: ''
                })
            }]),
            updateSetting: jest.fn().mockResolvedValue(true)
        };
        const settingsService = iniciarSettingsService(settingsSql);
        await settingsService.loadCache();

        await expect(settingsService.update('system_status', {
            maintenance_mode: true
        })).resolves.toEqual({
            maintenance_mode: true,
            sales_enabled: true,
            message: ''
        });

        expect(settingsSql.updateSetting).toHaveBeenCalledWith(
            'system_status',
            JSON.stringify({
                maintenance_mode: true,
                sales_enabled: true,
                message: ''
            })
        );
    });
});

describe('reglas de disponibilidad en el servicio de apuestas', () => {
    const financialRules = {
        min_bet_per_number: 500,
        max_ticket_total: 30000
    };

    test('mantenimiento prevalece sobre ventas deshabilitadas', async () => {
        const betSql = { recoverReplay: jest.fn(), processBetTransaction: jest.fn() };
        const limitSql = { obtenerLimiteDisponible: jest.fn() };
        const settingsService = {
            get: jest.fn((key) => key === 'system_status'
                ? { maintenance_mode: true, sales_enabled: false, message: '' }
                : financialRules)
        };

        await expect(createBetService(
            betSql,
            settingsService,
            limitSql,
            1,
            'request-maintenance',
            []
        )).rejects.toMatchObject({
            statusCode: 503,
            publicCode: 'MAINTENANCE_MODE'
        });

        expect(limitSql.obtenerLimiteDisponible).not.toHaveBeenCalled();
        expect(betSql.processBetTransaction).not.toHaveBeenCalled();
    });

    test('ventas deshabilitadas impiden iniciar operaciones financieras', async () => {
        const betSql = { recoverReplay: jest.fn(), processBetTransaction: jest.fn() };
        const limitSql = { obtenerLimiteDisponible: jest.fn() };
        const settingsService = {
            get: jest.fn((key) => key === 'system_status'
                ? { maintenance_mode: false, sales_enabled: false, message: '' }
                : financialRules)
        };

        await expect(createBetService(
            betSql,
            settingsService,
            limitSql,
            1,
            'request-disabled',
            [{ draw_id: 1, number_played: '05', amount: 500 }]
        )).rejects.toMatchObject({
            statusCode: 503,
            publicCode: 'SALES_DISABLED'
        });

        expect(limitSql.obtenerLimiteDisponible).not.toHaveBeenCalled();
        expect(betSql.processBetTransaction).not.toHaveBeenCalled();
    });

    test('ventas habilitadas conservan el flujo normal', async () => {
        const betSql = {
            recoverReplay: jest.fn().mockResolvedValue(null),
            processBetTransaction: jest.fn().mockResolvedValue({
                ticket_code: 'TICKET-1',
                bet_id: 10,
                total_amount: '500.00'
            })
        };
        const limitSql = {
            obtenerLimiteDisponible: jest.fn().mockResolvedValue(10000)
        };
        const settingsService = {
            get: jest.fn((key) => key === 'system_status'
                ? { maintenance_mode: false, sales_enabled: true, message: '' }
                : financialRules)
        };

        await expect(createBetService(
            betSql,
            settingsService,
            limitSql,
            1,
            'request-enabled',
            [{ draw_id: 1, number_played: '05', amount: 500 }]
        )).resolves.toMatchObject({
            bet_id: 10,
            status: 'CONFIRMED'
        });

        expect(limitSql.obtenerLimiteDisponible).toHaveBeenCalledTimes(1);
        expect(betSql.processBetTransaction).toHaveBeenCalledTimes(1);
    });

    test('un replay confirmado se recupera antes de reevaluar KYC, reglas y disponibilidad', async () => {
        const betSql = {
            recoverReplay: jest.fn().mockResolvedValue({
                ticket_code: 'TICKET-REPLAY', bet_id: 22, total_amount: '500.00'
            }),
            processBetTransaction: jest.fn()
        };
        const limitSql = { obtenerLimiteDisponible: jest.fn() };
        const settingsService = {
            get: jest.fn((key) => key === 'system_status'
                ? { maintenance_mode: false, sales_enabled: true, message: '' }
                : null)
        };

        await expect(createBetService(
            betSql, settingsService, limitSql, 1, 'request-replay',
            [{ draw_id: 1, number_played: '05', amount: 500 }]
        )).resolves.toEqual({
            ticket_code: 'TICKET-REPLAY', bet_id: 22, total_amount: '500.00', status: 'CONFIRMED'
        });

        expect(limitSql.obtenerLimiteDisponible).not.toHaveBeenCalled();
        expect(betSql.processBetTransaction).not.toHaveBeenCalled();
    });
});
