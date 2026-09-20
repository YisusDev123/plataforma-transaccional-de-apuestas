import { describe, expect, jest, test } from '@jest/globals';
import {
    getAdminDrawLimitsService,
    getDrawAvailabilityService,
    listAdminDrawsService,
    listOpenDrawsService
} from '../modules/draw/draw-service.js';
import { iniciarBaseDeDatosDraw } from '../shared/database/draw-sql.js';

function crearSettingsService(overrides = {}) {
    const values = {
        system_status: {
            maintenance_mode: false,
            sales_enabled: true,
            message: ''
        },
        financial_rules: {
            min_bet_per_number: 500,
            max_ticket_total: 30000
        },
        ...overrides
    };

    return {
        get: jest.fn((key) => values[key])
    };
}

describe('consultas de sorteos para usuarios', () => {
    test('lista sorteos OPEN junto con reglas seguras para apostar', async () => {
        const drawSql = {
            listOpenDraws: jest.fn().mockResolvedValue([{
                draw_id: 10,
                lottery: 'NICA',
                modality: 'NORMAL',
                draw_date: '2026-08-27',
                schedule_time: '15:00:00',
                open_at: '2026-08-27T06:00:00Z',
                close_at: '2026-08-27T20:50:00Z',
                status: 'OPEN',
                payout_multiplier: '85.00',
                payout_rule_version: 2
            }])
        };

        await expect(listOpenDrawsService(drawSql, crearSettingsService()))
            .resolves.toEqual({
                sales_enabled: true,
                currency: 'CRC',
                timezone: 'America/Costa_Rica',
                bet_rules: {
                    min_bet_per_number: '500.00',
                    max_ticket_total: '30000.00'
                },
                draws: [expect.objectContaining({ draw_id: 10, status: 'OPEN', payout_multiplier: '85.00', payout_rule_version: 2 })]
            });
    });

    test('devuelve una lista vacía cuando no hay sorteos disponibles', async () => {
        const drawSql = {
            listOpenDraws: jest.fn().mockResolvedValue([])
        };

        const result = await listOpenDrawsService(drawSql, crearSettingsService({
            system_status: {
                maintenance_mode: false,
                sales_enabled: false,
                message: ''
            }
        }));

        expect(result.sales_enabled).toBe(false);
        expect(result.draws).toEqual([]);
    });

    test('entrega 100 números con monto decimal exacto y disponibilidad', async () => {
        const rows = Array.from({ length: 100 }, (_, index) => ({
            draw_id: 20,
            lottery: 'TICA',
            modality: 'NORMAL',
            draw_date: '2026-08-27',
            schedule_time: '13:00:00',
            open_at: '2026-08-27T06:00:00Z',
            close_at: '2026-08-27T18:50:00Z',
            status: 'OPEN',
            payout_multiplier: '200.00',
            payout_rule_version: 4,
            number_played: String(index).padStart(2, '0'),
            remaining_amount: index === 7 ? '0.00' : '2500.00',
            available: index === 7 ? 0 : 1
        }));
        const drawSql = {
            getDrawAvailability: jest.fn().mockResolvedValue(rows)
        };

        const result = await getDrawAvailabilityService(
            drawSql,
            crearSettingsService(),
            20
        );

        expect(result.draw).toEqual(expect.objectContaining({
            draw_id: 20,
            status: 'OPEN',
            payout_multiplier: '200.00',
            payout_rule_version: 4
        }));
        expect(result.numbers).toHaveLength(100);
        expect(result.numbers[7]).toEqual({
            number: '07',
            remaining_amount: '0.00',
            available: false
        });
        expect(result.numbers[8]).toEqual({
            number: '08',
            remaining_amount: '2500.00',
            available: true
        });
    });

    test('rechaza sorteos inexistentes, cerrados o con matriz incompleta', async () => {
        const missingSql = {
            getDrawAvailability: jest.fn().mockResolvedValue([])
        };
        const incompleteSql = {
            getDrawAvailability: jest.fn().mockResolvedValue(Array.from({ length: 99 }, (_, index) => ({
                draw_id: 30,
                number_played: String(index).padStart(2, '0'),
                remaining_amount: '1000.00',
                available: 1
            })))
        };

        await expect(getDrawAvailabilityService(
            missingSql,
            crearSettingsService(),
            999
        )).rejects.toMatchObject({ statusCode: 404 });

        await expect(getDrawAvailabilityService(
            incompleteSql,
            crearSettingsService(),
            30
        )).rejects.toMatchObject({
            statusCode: 503,
            publicCode: 'DRAW_LIMITS_INCOMPLETE'
        });
    });
});

describe('SQL de consulta de sorteos', () => {
    test('lista únicamente sorteos abiertos, vigentes y con 100 límites', async () => {
        const pool = {
            query: jest.fn().mockResolvedValue([[]])
        };
        const drawSql = iniciarBaseDeDatosDraw(pool);

        await drawSql.listOpenDraws();

        const [query, params] = pool.query.mock.calls[0];
        expect(query).toContain("d.status = 'OPEN'");
        expect(query).toContain('d.open_at <= UTC_TIMESTAMP()');
        expect(query).toContain('d.close_at > UTC_TIMESTAMP()');
        expect(query).toContain('COUNT(DISTINCT nl.number_played)');
        expect(query).toContain('JOIN payout_rules');
        expect(query).toMatch(/\)\s*=\s*100/);
        expect(params).toBeUndefined();
    });

    test('calcula remaining_amount en MySQL y parametriza draw_id', async () => {
        const pool = {
            query: jest.fn().mockResolvedValue([[]])
        };
        const drawSql = iniciarBaseDeDatosDraw(pool);

        await drawSql.getDrawAvailability(55);

        const [query, params] = pool.query.mock.calls[0];
        expect(query).toContain('GREATEST(nl.max_amount - nl.current_amount, 0.00)');
        expect(query).toContain("d.status = 'OPEN'");
        expect(query).toContain('d.close_at > UTC_TIMESTAMP()');
        expect(query).toContain('JOIN payout_rules');
        expect(params).toEqual([55]);
    });
});

describe('consultas administrativas de sorteos', () => {
    test('lista por estado y conserva el total para paginación', async () => {
        const drawSql = {
            listAdminDraws: jest.fn().mockResolvedValue({
                rows: [{ draw_id: 41, status: 'CLOSED', result_number: null }],
                total: 3
            })
        };

        await expect(listAdminDrawsService(drawSql, 'CLOSED', 10, 0)).resolves.toEqual({
            status: 'CLOSED',
            draws: [{ draw_id: 41, status: 'CLOSED', result_number: null }],
            total: 3
        });
        expect(drawSql.listAdminDraws).toHaveBeenCalledWith('CLOSED', 10, 0);
    });

    test('entrega una matriz exacta de 100 límites monetarios', async () => {
        const rows = Array.from({ length: 100 }, (_, index) => ({
            draw_id: 50,
            lottery: 'NICA',
            modality: 'NORMAL',
            draw_date: '2026-09-02',
            schedule_time: '15:00:00',
            status: 'OPEN',
            number_played: String(index).padStart(2, '0'),
            max_amount: '3000.00',
            current_amount: index === 5 ? '250.00' : '0.00',
            remaining_amount: index === 5 ? '2750.00' : '3000.00'
        }));
        const result = await getAdminDrawLimitsService({
            getAdminDrawLimits: jest.fn().mockResolvedValue(rows)
        }, 50);

        expect(result.draw).toEqual(expect.objectContaining({ draw_id: 50, status: 'OPEN' }));
        expect(result.numbers).toHaveLength(100);
        expect(result.numbers[5]).toEqual({
            number: '05',
            max_amount: '3000.00',
            current_amount: '250.00',
            remaining_amount: '2750.00'
        });
    });

    test('rechaza sorteos sin límites o con matriz incompleta', async () => {
        await expect(getAdminDrawLimitsService({
            getAdminDrawLimits: jest.fn().mockResolvedValue([])
        }, 1)).rejects.toMatchObject({ statusCode: 404 });
        await expect(getAdminDrawLimitsService({
            getAdminDrawLimits: jest.fn().mockResolvedValue(Array.from({ length: 99 }, () => ({})))
        }, 1)).rejects.toMatchObject({ statusCode: 503, publicCode: 'DRAW_LIMITS_INCOMPLETE' });
    });

    test('SQL administrativo parametriza estado, paginación y draw_id', async () => {
        const pool = {
            execute: jest.fn()
                .mockResolvedValueOnce([[{ draw_id: 1, status: 'CLOSED' }]])
                .mockResolvedValueOnce([[{ total: 1 }]]),
            query: jest.fn().mockResolvedValue([[]])
        };
        const drawSql = iniciarBaseDeDatosDraw(pool);

        await drawSql.listAdminDraws('CLOSED', 10, 0);
        expect(pool.execute.mock.calls[0][1]).toEqual(['CLOSED', '10', '0']);
        expect(pool.execute.mock.calls[1][1]).toEqual(['CLOSED']);

        await drawSql.getAdminDrawLimits(77);
        expect(pool.query.mock.calls[0][1]).toEqual([77]);
        expect(pool.query.mock.calls[0][0]).toContain('GREATEST(nl.max_amount - nl.current_amount, 0.00)');
    });
});
