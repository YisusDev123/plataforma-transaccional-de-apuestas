import { describe, expect, jest, test } from '@jest/globals';
import { iniciarSettingsSql } from '../shared/database/setting-sql.js';

function createConnection(results) {
    return {
        beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
        query: jest.fn().mockImplementation(() => Promise.resolve(results.shift()))
    };
}

describe('transacción de reglas de sorteos', () => {
    test('rechaza cambiar el cierre si existe un sorteo OPEN', async () => {
        const connection = createConnection([[[{ id: 1, status: 'OPEN' }]]]);
        const sql = iniciarSettingsSql({ getConnection: async () => connection });

        await expect(sql.updateDrawDefaultsConTransaccion('draw_defaults', '{}', { closeMinutes: 15 }))
            .rejects.toMatchObject({ statusCode: 409, publicCode: 'OPEN_DRAWS_PREVENT_CLOSE_RULE_CHANGE' });
        expect(connection.query).toHaveBeenCalledTimes(1);
        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.commit).not.toHaveBeenCalled();
    });

    test('recalcula PENDING y deja la disponibilidad como vendido más monto nuevo', async () => {
        const connection = createConnection([
            [[{ id: 2, status: 'PENDING' }]], [[{ id: 10 }]], [{ affectedRows: 100 }],
            [{ affectedRows: 1 }], [{ affectedRows: 1 }]
        ]);
        const sql = iniciarSettingsSql({ getConnection: async () => connection });

        await expect(sql.updateDrawDefaultsConTransaccion('draw_defaults', '{"default_risk_limit":500,"auto_close_minutes_before":15}', {
            availableAmount: 500, closeMinutes: 15
        })).resolves.toBe(true);

        expect(connection.query.mock.calls[1][0]).toContain('ORDER BY nl.draw_id, nl.number_played');
        expect(connection.query.mock.calls[2]).toEqual(expect.arrayContaining([
            expect.stringContaining('nl.current_amount + ?'), [500]
        ]));
        expect(connection.query.mock.calls[3]).toEqual(expect.arrayContaining([
            expect.stringContaining("WHERE status = 'PENDING'"), [15]
        ]));
        expect(connection.commit).toHaveBeenCalledTimes(1);
    });
});
