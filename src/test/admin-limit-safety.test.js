import { describe, expect, jest, test } from '@jest/globals';
import { iniciarBaseDeDatosLimits } from '../shared/database/limit-sql.js';

function connectionFor({ status = 'OPEN', limit = { id: 12, max_amount: '3000.00', current_amount: '3000.00' }, update = { affectedRows: 1 }, audit = { affectedRows: 1 } } = {}) {
    return {
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
        query: jest.fn()
            .mockResolvedValueOnce([[{ id: 7, status }]])
            .mockResolvedValueOnce([limit ? [limit] : []])
            .mockResolvedValueOnce([update])
            .mockResolvedValueOnce([audit])
    };
}

describe('seguridad al modificar límites administrativos', () => {
    test.each(['CLOSED', 'RESULT_LOADED', 'PAID', 'CANCELLED'])('rechaza un sorteo en estado %s y revierte', async (status) => {
        const connection = connectionFor({ status });
        const sql = iniciarBaseDeDatosLimits({ getConnection: jest.fn().mockResolvedValue(connection) });

        await expect(sql.actualizarMaxAmount(1, '127.0.0.1', 'test', 7, '05', 4000, 3000))
            .rejects.toMatchObject({ statusCode: 409, publicCode: 'DRAW_NOT_EDITABLE' });
        expect(connection.query).toHaveBeenCalledTimes(1);
        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.commit).not.toHaveBeenCalled();
    });

    test.each(['PENDING', 'OPEN'])('aumenta un número agotado en estado %s de forma atómica', async (status) => {
        const connection = connectionFor({ status });
        const sql = iniciarBaseDeDatosLimits({ getConnection: jest.fn().mockResolvedValue(connection) });

        await expect(sql.actualizarMaxAmount(1, '127.0.0.1', 'test', 7, '05', 4000, 3000)).resolves.toEqual({
            previousMaxAmount: '3000.00', newMaxAmount: '4000.00', currentAmount: '3000.00', remainingAmount: '1000.00'
        });
        expect(connection.query.mock.calls[0][0]).toContain('FROM draws WHERE id = ? FOR UPDATE');
        expect(connection.query.mock.calls[1][0]).toContain('FROM number_limits');
        expect(connection.query.mock.calls[2]).toEqual(expect.arrayContaining([expect.stringContaining('UPDATE number_limits'), ['4000.00', 12]]));
        expect(connection.commit).toHaveBeenCalledTimes(1);
        expect(connection.rollback).not.toHaveBeenCalled();
    });

    test('interpreta remaining_amount como disponibilidad nueva y conserva lo vendido', async () => {
        const connection = connectionFor({ limit: { id: 12, max_amount: '5000.00', current_amount: '3500.00' } });
        const sql = iniciarBaseDeDatosLimits({ getConnection: jest.fn().mockResolvedValue(connection) });

        await expect(sql.actualizarMaxAmount(1, '127.0.0.1', 'test', 7, '05', undefined, 5000, 750.25))
            .resolves.toEqual({
                previousMaxAmount: '5000.00', newMaxAmount: '4250.25', currentAmount: '3500.00',
                remainingAmount: '750.25', requestedRemainingAmount: '750.25'
            });
        expect(connection.query.mock.calls[2][1]).toEqual(['4250.25', 12]);
        expect(JSON.parse(connection.query.mock.calls[3][1][2])).toEqual(expect.objectContaining({
            current_amount: '3500.00', requested_remaining_amount: '750.25', remaining_amount: '750.25'
        }));
    });

    test('rechaza bajar el máximo por debajo del monto vendido', async () => {
        const connection = connectionFor({ limit: { id: 12, max_amount: '5000.00', current_amount: '3500.00' } });
        const sql = iniciarBaseDeDatosLimits({ getConnection: jest.fn().mockResolvedValue(connection) });

        await expect(sql.actualizarMaxAmount(1, '127.0.0.1', 'test', 7, '05', 3000, 5000))
            .rejects.toMatchObject({ statusCode: 409, publicCode: 'LIMIT_BELOW_EXPOSURE' });
        expect(connection.query).toHaveBeenCalledTimes(2);
        expect(connection.rollback).toHaveBeenCalledTimes(1);
    });

    test('detecta una edición concurrente por el máximo esperado', async () => {
        const connection = connectionFor({ limit: { id: 12, max_amount: '4500.00', current_amount: '3000.00' } });
        const sql = iniciarBaseDeDatosLimits({ getConnection: jest.fn().mockResolvedValue(connection) });

        await expect(sql.actualizarMaxAmount(1, '127.0.0.1', 'test', 7, '05', 5000, 3000))
            .rejects.toMatchObject({ statusCode: 409, publicCode: 'LIMIT_CHANGED' });
        expect(connection.query).toHaveBeenCalledTimes(2);
        expect(connection.rollback).toHaveBeenCalledTimes(1);
    });

    test('una fila ausente no se recrea silenciosamente', async () => {
        const connection = connectionFor({ limit: null });
        const sql = iniciarBaseDeDatosLimits({ getConnection: jest.fn().mockResolvedValue(connection) });

        await expect(sql.actualizarMaxAmount(1, '127.0.0.1', 'test', 7, '05', 4000, 3000))
            .rejects.toMatchObject({ statusCode: 503, publicCode: 'DRAW_LIMITS_INCOMPLETE' });
        expect(connection.query).toHaveBeenCalledTimes(2);
    });
});
