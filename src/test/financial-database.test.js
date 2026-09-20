import { describe, expect, jest, test } from '@jest/globals';
import { iniciarBaseDeDatosPayout } from '../shared/database/payout-sql.js';
import { iniciarBaseDeDatosBet } from '../shared/database/bet-sql.js';
import { iniciarCancelDrawSql } from '../shared/database/cancel-draw-sql.js';

describe('protecciones financieras de repositorios', () => {
    test('el historial filtra el ticket visible dentro de la cuenta del usuario', async () => {
        const executed = [];
        const pool = {
            execute: jest.fn(async (sql, params) => {
                executed.push({ sql, params });
                if (sql.includes('COUNT(*)')) return [[{ total: 1 }]];
                return [[{ id: 9, ticket_code: '6E6F55BA64DE' }]];
            })
        };
        const betSql = iniciarBaseDeDatosBet(pool, {});

        const result = await betSql.listarApuestasUsuario(7, { ticketCode: '6E6F55BA64DE' }, 10, 0);

        expect(result.total).toBe(1);
        expect(executed[0].sql).toContain('b.user_id = ?');
        expect(executed[0].sql).toContain('b.ticket_code = ?');
        expect(executed[0].params).toEqual([7, '6E6F55BA64DE', '10', '0']);
        expect(executed[1].params).toEqual([7, '6E6F55BA64DE']);
    });

    test('processWinner no acredita dos veces un bet_item procesado', async () => {
        let payoutProcessed = 0;
        let walletUpdates = 0;
        const connection = {
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn(),
            query: jest.fn(async (sql, _params) => {
                if (sql.includes('FROM bet_items bi')) {
                    return [[{
                        id: 5,
                        amount: '10.00',
                        payout_multiplier_snapshot: '90',
                        payout_processed: payoutProcessed,
                        user_id: 7
                    }]];
                }
                if (sql.includes('FROM wallets')) {
                    return [[{ id: 11, available_balance: '100.00' }]];
                }
                if (sql.startsWith('UPDATE wallets')) {
                    walletUpdates++;
                    return [{ affectedRows: 1 }];
                }
                if (sql.startsWith('INSERT INTO wallet_transactions')) {
                    return [{ affectedRows: 1 }];
                }
                if (sql.includes("UPDATE bet_items SET status = 'WON'")) {
                    payoutProcessed = 1;
                    return [{ affectedRows: 1 }];
                }
                throw new Error(`Consulta inesperada en prueba: ${sql}`);
            })
        };
        const payoutSql = iniciarBaseDeDatosPayout({
            getConnection: jest.fn().mockResolvedValue(connection)
        });

        await expect(payoutSql.processWinner({ id: 5 })).resolves.toBe(true);
        await expect(payoutSql.processWinner({ id: 5 })).resolves.toBe(false);

        expect(walletUpdates).toBe(1);
        expect(connection.commit).toHaveBeenCalledTimes(1);
        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.release).toHaveBeenCalledTimes(2);
    });

    test('las apuestas bloquean límites en orden canónico', async () => {
        const locked = [];
        let insertedItems;
        let payoutRuleQuery;
        const limitSql = {
            obtenerYBloquearLimite: jest.fn(async (_connection, drawId, numberPlayed) => {
                locked.push(`${drawId}:${numberPlayed}`);
                return { id: locked.length, current_amount: '0', max_amount: '1000' };
            }),
            aumentarMontoActual: jest.fn()
        };
        const connection = {
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn(),
            query: jest.fn(async (sql, params) => {
                if (sql.includes('FROM users u')) {
                    return [[{ status: 'ACTIVE', kyc_status: 'APPROVED', full_name: 'María Pérez' }]];
                }
                if (sql.includes('FROM draws WHERE id IN')) {
                    return [[
                        { id: 1, lottery: 'NICA', modality: 'NORMAL', draw_date: '2999-01-01', schedule_time: '13:00:00', status: 'OPEN', close_at: '2999-01-01 00:00:00' },
                        { id: 2, lottery: 'NICA', modality: 'NORMAL', draw_date: '2999-01-02', schedule_time: '15:00:00', status: 'OPEN', close_at: '2999-01-01 00:00:00' }
                    ]];
                }
                if (sql.includes('FROM payout_rules')) {
                    payoutRuleQuery = sql;
                    return [[{ lottery: 'NICA', modality: 'NORMAL', multiplier: 90 }]];
                }
                if (sql.includes('FROM wallets')) {
                    return [[{ id: 50, available_balance: '1000.00' }]];
                }
                if (sql.startsWith('UPDATE wallets')) return [{ affectedRows: 1 }];
                if (sql.includes('UTC_TIMESTAMP')) return [[{ accepted_at: '2026-09-05T15:00:00Z', created_at: '2026-09-05 15:00:00' }]];
                if (sql.includes('INSERT INTO bets')) return [{ affectedRows: 1, insertId: 80 }];
                if (sql.startsWith('INSERT INTO wallet_transactions')) return [{ affectedRows: 1 }];
                if (sql.startsWith('INSERT INTO bet_items')) {
                    insertedItems = params;
                    return [{ affectedRows: 3 }];
                }
                throw new Error(`Consulta inesperada en prueba: ${sql}`);
            })
        };
        const betSql = iniciarBaseDeDatosBet({
            getConnection: jest.fn().mockResolvedValue(connection)
        }, limitSql);

        await betSql.processBetTransaction(9, 'request-1', [
            { draw_id: 2, number_played: '20', amount: 10 },
            { draw_id: 1, number_played: '30', amount: 10 },
            { draw_id: 1, number_played: '10', amount: 10 }
        ]);

        expect(locked).toEqual(['1:10', '1:30', '2:20']);
        expect(payoutRuleQuery).toContain('FOR SHARE');
        expect(connection.query.mock.calls.find(([sql]) => sql.includes('FROM payout_rules'))[1]).toEqual(['NICA', 'NORMAL']);
        expect(insertedItems[0][0][4]).toBe('90.00');
        const betInsert = connection.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO bets'));
        expect(betInsert[0]).toContain('customer_name_snapshot');
        expect(betInsert[0]).not.toContain('receipt_snapshot');
        expect(betInsert[1][4]).toBe('María Pérez');
        expect(connection.commit).toHaveBeenCalledTimes(1);
    });

    test('una apuesta nueva sin KYC aprobado revierte antes de tocar límites o billetera', async () => {
        const limitSql = {
            obtenerYBloquearLimite: jest.fn(),
            aumentarMontoActual: jest.fn()
        };
        const connection = {
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn(),
            query: jest.fn(async (sql) => {
                if (sql.includes('FROM users u')) {
                    return [[{ status: 'ACTIVE', kyc_status: 'PENDING' }]];
                }
                throw new Error(`Consulta inesperada en prueba: ${sql}`);
            })
        };
        const betSql = iniciarBaseDeDatosBet({
            getConnection: jest.fn().mockResolvedValue(connection)
        }, limitSql);

        await expect(betSql.processBetTransaction(9, 'request-kyc', [
            { draw_id: 1, number_played: '10', amount: 10 }
        ])).rejects.toMatchObject({ statusCode: 403, publicCode: 'KYC_REQUIRED' });

        expect(limitSql.obtenerYBloquearLimite).not.toHaveBeenCalled();
        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.commit).not.toHaveBeenCalled();
        expect(connection.release).toHaveBeenCalledTimes(1);
    });

    test('cancelar un sorteo inexistente genera 404 y libera la conexión', async () => {
        const connection = {
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn(),
            query: jest.fn().mockResolvedValue([[]])
        };
        const cancelSql = iniciarCancelDrawSql({
            getConnection: jest.fn().mockResolvedValue(connection)
        });

        await expect(cancelSql.executeCancelAndRefund(999))
            .rejects.toMatchObject({ statusCode: 404 });
        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.release).toHaveBeenCalledTimes(1);
    });
});
