import { describe, expect, jest, test } from '@jest/globals';
import { ejecutarMotorDePagos } from '../modules/jobs/payout-worker.js';

describe('coordinación del motor de pagos', () => {
    test('reconoce como ganador un número canónico con cero inicial', async () => {
        const lock = { lockName: 'lottery:payout:1' };
        const payoutSql = {
            getPendingResults: jest.fn().mockResolvedValue([
                { id: 1, draw_id: 10, winning_number: '05' }
            ]),
            acquireResultLock: jest.fn().mockResolvedValue(lock),
            updateResultStatus: jest.fn().mockResolvedValue(true),
            getUnprocessedBetItems: jest.fn()
                .mockResolvedValueOnce([{ id: 8, bet_id: 3, number_played: '05' }])
                .mockResolvedValueOnce([]),
            processWinner: jest.fn().mockResolvedValue(true),
            processLoser: jest.fn(),
            evaluateParentBet: jest.fn(),
            markResultCompleted: jest.fn(),
            releaseResultLock: jest.fn()
        };

        await ejecutarMotorDePagos(payoutSql);

        expect(payoutSql.processWinner).toHaveBeenCalledWith(
            expect.objectContaining({ number_played: '05' })
        );
        expect(payoutSql.processLoser).not.toHaveBeenCalled();
        expect(payoutSql.evaluateParentBet).toHaveBeenCalledWith(3);
    });

    test('omite resultados bloqueados y libera el bloqueo adquirido', async () => {
        const lock = { lockName: 'lottery:payout:2' };
        const payoutSql = {
            getPendingResults: jest.fn().mockResolvedValue([
                { id: 1, draw_id: 10, winning_number: '05' },
                { id: 2, draw_id: 20, winning_number: '07' }
            ]),
            acquireResultLock: jest.fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(lock),
            updateResultStatus: jest.fn().mockResolvedValue(true),
            getUnprocessedBetItems: jest.fn().mockResolvedValue([]),
            markResultCompleted: jest.fn(),
            releaseResultLock: jest.fn()
        };

        await ejecutarMotorDePagos(payoutSql);

        expect(payoutSql.updateResultStatus).toHaveBeenCalledTimes(1);
        expect(payoutSql.updateResultStatus).toHaveBeenCalledWith(2, 'PROCESSING');
        expect(payoutSql.markResultCompleted).toHaveBeenCalledWith(2, 20);
        expect(payoutSql.releaseResultLock).toHaveBeenCalledWith(lock);
    });

    test('libera el bloqueo aunque el procesamiento falle', async () => {
        const lock = { lockName: 'lottery:payout:1' };
        const failure = new Error('fallo simulado');
        const payoutSql = {
            getPendingResults: jest.fn().mockResolvedValue([{ id: 1, draw_id: 10 }]),
            acquireResultLock: jest.fn().mockResolvedValue(lock),
            updateResultStatus: jest.fn().mockResolvedValue(true),
            getUnprocessedBetItems: jest.fn().mockRejectedValue(failure),
            releaseResultLock: jest.fn()
        };

        await expect(ejecutarMotorDePagos(payoutSql)).rejects.toThrow('fallo simulado');
        expect(payoutSql.releaseResultLock).toHaveBeenCalledWith(lock);
    });
});
