import { describe, expect, jest, test } from '@jest/globals';
import { configureTimedPool, decorateTimedConnection } from '../config/mysql-timeouts.js';

function connectionDouble(overrides = {}) {
    return {
        query: jest.fn().mockResolvedValue([[], []]),
        execute: jest.fn().mockResolvedValue([[], []]),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
        destroy: jest.fn(),
        ...overrides
    };
}

describe('timeouts de comandos MySQL', () => {
    test('aplica el máximo global a query, execute y controles transaccionales', async () => {
        const rawQuery = jest.fn().mockResolvedValue([[], []]);
        const rawExecute = jest.fn().mockResolvedValue([[], []]);
        const connection = connectionDouble({ query: rawQuery, execute: rawExecute });
        decorateTimedConnection(connection, 8000);

        await connection.query('SELECT 1');
        await connection.execute({ sql: 'SELECT ?', timeout: 12000 }, [1]);
        await connection.beginTransaction();
        await connection.commit();
        await connection.rollback();

        expect(rawQuery.mock.calls.map(([options]) => options)).toEqual([
            { sql: 'SELECT 1', timeout: 8000 },
            { sql: 'START TRANSACTION', timeout: 8000 },
            { sql: 'COMMIT', timeout: 8000 },
            { sql: 'ROLLBACK', timeout: 8000 }
        ]);
        expect(rawExecute).toHaveBeenCalledWith({ sql: 'SELECT ?', timeout: 8000 }, [1]);
    });

    test('descarta la conexión y devuelve un 503 seguro cuando una consulta vence', async () => {
        const timeout = Object.assign(new Error('Query inactivity timeout'), {
            code: 'PROTOCOL_SEQUENCE_TIMEOUT'
        });
        const rawQuery = jest.fn().mockRejectedValue(timeout);
        const connection = connectionDouble({ query: rawQuery });
        decorateTimedConnection(connection, 8000);

        await expect(connection.query('SELECT SLEEP(30)')).rejects.toEqual(expect.objectContaining({
            code: 'DATABASE_QUERY_TIMEOUT', statusCode: 503, publicCode: 'SERVICE_BUSY'
        }));
        expect(rawQuery).toHaveBeenCalledWith({ sql: 'SELECT SLEEP(30)', timeout: 8000 }, undefined);
        expect(connection.destroy).toHaveBeenCalledTimes(1);
        await expect(connection.rollback()).resolves.toBeUndefined();
    });

    test('marca como incierto un timeout durante commit sin ocultarlo con rollback', async () => {
        const timeout = Object.assign(new Error('timeout'), { code: 'PROTOCOL_SEQUENCE_TIMEOUT' });
        const rawQuery = jest.fn(async options => {
            if (options.sql === 'COMMIT') throw timeout;
            return [[], []];
        });
        const connection = connectionDouble({ query: rawQuery });
        decorateTimedConnection(connection, 5000);

        await expect(connection.commit()).rejects.toEqual(expect.objectContaining({
            code: 'DATABASE_QUERY_TIMEOUT', outcomeUnknown: true
        }));
        await expect(connection.rollback()).resolves.toBeUndefined();
        expect(connection.destroy).toHaveBeenCalledTimes(1);
    });

    test('el pool libera conexiones sanas y conserva un timeout explícito más corto', async () => {
        const rawQuery = jest.fn().mockResolvedValue([[{ ok: 1 }], []]);
        const connection = connectionDouble({ query: rawQuery });
        const pool = {
            getConnection: jest.fn().mockResolvedValue(connection),
            query: jest.fn(),
            execute: jest.fn()
        };
        configureTimedPool(pool, 8000);

        await expect(pool.query({ sql: 'SELECT 1', timeout: 1000 })).resolves.toEqual([[{ ok: 1 }], []]);
        expect(rawQuery).toHaveBeenCalledWith({ sql: 'SELECT 1', timeout: 1000 }, undefined);
        expect(connection.release).toHaveBeenCalledTimes(1);
    });
});
