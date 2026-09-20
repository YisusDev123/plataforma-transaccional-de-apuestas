import { describe, expect, jest, test } from '@jest/globals';
import { updateDepositDestinationSchema } from '../schemas/admin-schemas.js';
import { createDepositSchema } from '../schemas/deposits-schema.js';
import { iniciarBaseDeDatosDepositDestination } from '../shared/database/deposit-destination-sql.js';
import { iniciarBaseDeDatosDeposits } from '../shared/database/deposits-sql.js';

function transactionPool(queryImplementation) {
    const connection = {
        beginTransaction: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        release: jest.fn(),
        query: jest.fn(queryImplementation),
    };
    return { pool: { getConnection: jest.fn().mockResolvedValue(connection), query: jest.fn() }, connection };
}

describe('destinos versionados de depósitos', () => {
    test.each([
        [{ type: 'BANK_ACCOUNT', destinationValue: 'CR00 0000-0000 0000 0000 00', accountHolder: 'Comercio Demo' }, 'CR00000000000000000000'],
        [{ type: 'SINPE_MOVIL', destinationValue: '8888-8888', accountHolder: 'Comercio Demo' }, '88888888'],
    ])('valida y normaliza cada tipo', (input, expected) => {
        const result = updateDepositDestinationSchema.validate(input);
        expect(result.error).toBeUndefined();
        expect(result.value.destinationValue).toBe(expected);
    });

    test('rechaza un IBAN o SINPE que no corresponda al tipo', () => {
        expect(updateDepositDestinationSchema.validate({
            type: 'BANK_ACCOUNT', destinationValue: '88888888', accountHolder: 'Comercio Demo'
        }).error).toBeDefined();
        expect(updateDepositDestinationSchema.validate({
            type: 'SINPE_MOVIL', destinationValue: 'CR00000000000000000000', accountHolder: 'Comercio Demo'
        }).error).toBeDefined();
    });

    test('exige el destino concreto al crear un depósito', () => {
        const result = createDepositSchema.validate({
            amount: 1000, referenceNumber: 'REF-1', requestId: 'request-deposit-123456'
        });
        expect(result.error).toBeDefined();
        expect(result.error.details[0].type).toBe('any.required');
    });

    test('actualiza únicamente el estado del tipo bajo bloqueo y audita sin guardar el dato completo', async () => {
        const { pool, connection } = transactionPool((sql) => {
            if (sql.includes('SELECT current_destination_id')) return Promise.resolve([[{ current_destination_id: 3, version: 2 }]]);
            if (sql.includes('INSERT INTO deposit_destinations')) return Promise.resolve([{ insertId: 8 }]);
            return Promise.resolve([{ affectedRows: 1 }]);
        });
        const database = iniciarBaseDeDatosDepositDestination(pool);
        const result = await database.actualizarDestinoTransaccional(4, {
            type: 'SINPE_MOVIL', destinationValue: '88888888', accountHolder: 'Comercio Demo'
        }, '127.0.0.1');

        expect(result).toMatchObject({ id: 8, type: 'SINPE_MOVIL', version: 3 });
        expect(connection.query.mock.calls[0]).toEqual([
            expect.stringContaining('WHERE type = ? FOR UPDATE'), ['SINPE_MOVIL']
        ]);
        const updateCall = connection.query.mock.calls.find(([sql]) => sql.includes('UPDATE deposit_destination_state'));
        expect(updateCall[1]).toEqual([8, 3, 'SINPE_MOVIL']);
        const auditCall = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO audit_logs'));
        expect(auditCall[1][2]).not.toContain('88888888');
        expect(auditCall[1][2]).toContain('8888');
        expect(connection.commit).toHaveBeenCalledTimes(1);
    });

    test('revierte la actualización si falla la auditoría', async () => {
        const { pool, connection } = transactionPool((sql) => {
            if (sql.includes('SELECT current_destination_id')) return Promise.resolve([[{ current_destination_id: null, version: 0 }]]);
            if (sql.includes('INSERT INTO deposit_destinations')) return Promise.resolve([{ insertId: 9 }]);
            if (sql.includes('INSERT INTO audit_logs')) return Promise.reject(new Error('audit failed'));
            return Promise.resolve([{ affectedRows: 1 }]);
        });
        const database = iniciarBaseDeDatosDepositDestination(pool);
        await expect(database.actualizarDestinoTransaccional(4, {
            type: 'BANK_ACCOUNT', destinationValue: 'CR00000000000000000000', accountHolder: 'Comercio Demo'
        }, '127.0.0.1')).rejects.toThrow('audit failed');
        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.commit).not.toHaveBeenCalled();
    });

    test('crea el depósito con el destino seleccionado dentro de la misma transacción', async () => {
        const { pool, connection } = transactionPool((sql) => {
            if (sql.includes('FROM deposits WHERE request_id')) return Promise.resolve([[]]);
            if (sql.includes('FROM deposits WHERE reference_number')) return Promise.resolve([[]]);
            if (sql.includes('FROM deposit_destinations')) return Promise.resolve([[{ id: 12 }]]);
            if (sql.includes('INSERT INTO deposits')) return Promise.resolve([{ insertId: 31, affectedRows: 1 }]);
            return Promise.resolve([[]]);
        });
        const database = iniciarBaseDeDatosDeposits(pool);
        await expect(database.crearDepositoTransaccional(7, 1000, 'REF-31', 'request-31', 12))
            .resolves.toEqual({ id: 31, status: 'PENDING' });
        const insertCall = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO deposits'));
        expect(insertCall[1]).toEqual([7, 1000, 'REF-31', 'request-31', 12]);
        expect(connection.commit).toHaveBeenCalledTimes(1);
    });
});
