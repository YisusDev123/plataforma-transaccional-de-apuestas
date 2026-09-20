import { describe, expect, jest, test } from '@jest/globals';
import { applyDrawDefaultsMigration } from '../shared/database/draw-defaults-migration.js';

function connectionWith(results) {
    return {
        beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(),
        query: jest.fn().mockImplementation(() => Promise.resolve(results.shift()))
    };
}

describe('migración de draw_defaults', () => {
    test('actualiza la regla y los sorteos PENDING dentro de una transacción', async () => {
        const connection = connectionWith([
            [[{ setting_value: JSON.stringify({ default_risk_limit: 3000, auto_close_minutes_before: 5 }) }]],
            [[{ id: 4, status: 'PENDING' }]],
            [{ affectedRows: 4 }],
            [{ affectedRows: 1 }]
        ]);

        await expect(applyDrawDefaultsMigration(connection, 10)).resolves.toEqual({
            changed: true, previousCloseMinutes: 5, closeMinutes: 10, pendingDrawsUpdated: 4
        });
        expect(connection.query.mock.calls[2]).toEqual(expect.arrayContaining([
            expect.stringContaining("WHERE status = 'PENDING'"), [10]
        ]));
        expect(connection.commit).toHaveBeenCalledTimes(1);
    });

    test('rechaza y revierte si hay un sorteo OPEN', async () => {
        const connection = connectionWith([
            [[{ setting_value: JSON.stringify({ default_risk_limit: 3000, auto_close_minutes_before: 5 }) }]],
            [[{ id: 9, status: 'OPEN' }]]
        ]);

        await expect(applyDrawDefaultsMigration(connection, 10))
            .rejects.toMatchObject({ publicCode: 'OPEN_DRAWS_PREVENT_CLOSE_RULE_CHANGE' });
        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.commit).not.toHaveBeenCalled();
    });
});
