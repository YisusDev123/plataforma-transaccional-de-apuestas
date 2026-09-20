import { describe, expect, jest, test } from '@jest/globals';
import { createBetSchema } from '../schemas/bet-schema.js';
import { createDepositSchema } from '../schemas/deposits-schema.js';
import { loadResultsSchema } from '../schemas/draw-schema.js';
import { modificarLimiteSchema } from '../schemas/limit-schema.js';
import { settingsBodySchemas } from '../schemas/setting-schema.js';
import { requestWithdrawalSchema } from '../schemas/withdrawls-schema.js';
import { loadResultsService } from '../modules/draw/draw-service.js';
import { betHistoryQuerySchema } from '../schemas/financial-history-schema.js';

describe('contratos financieros de entrada', () => {
    test('el historial de apuestas acepta y normaliza un código público de ticket', () => {
        const valid = betHistoryQuerySchema.validate({ ticketCode: '6e6f55ba64de' });
        const invalid = betHistoryQuerySchema.validate({ ticketCode: 'ticket-inválido' });

        expect(valid.error).toBeUndefined();
        expect(valid.value.ticketCode).toBe('6E6F55BA64DE');
        expect(invalid.error).toBeDefined();
    });

    test.each([
        ['apuesta', createBetSchema, {
            request_id: 'money-test',
            bets: [{ draw_id: 1, number_played: '05', amount: 1.239 }]
        }],
        ['depósito', createDepositSchema, {
            amount: 1.239, referenceNumber: 'REF-1', requestId: 'deposit-1', destinationId: 1
        }],
        ['retiro', requestWithdrawalSchema, {
            amount: 1.239, destinationAccount: 'CR123', destinationAccountHolder: 'Persona Titular', requestId: 'withdrawal-1'
        }],
        ['límite', modificarLimiteSchema, {
            draw_id: 1, number_played: 5, max_amount: 1.239
        }]
    ])('%s rechaza montos con más de dos decimales', (_name, schema, payload) => {
        expect(schema.validate(payload).error).toBeDefined();
    });

    test('rechaza montos expresados como strings o notación exponencial', () => {
        const numericString = createDepositSchema.validate({
            amount: '100.25', referenceNumber: 'REF-1', requestId: 'deposit-1', destinationId: 1
        });
        const exponentialString = createDepositSchema.validate({
            amount: '1e3', referenceNumber: 'REF-2', requestId: 'deposit-2', destinationId: 1
        });

        expect(numericString.error).toBeDefined();
        expect(exponentialString.error).toBeDefined();
    });

    test('acepta cero solo para límites de riesgo y conserva dos decimales válidos', () => {
        expect(modificarLimiteSchema.validate({
            draw_id: 1, number_played: 5, max_amount: 0
        }).error).toBeUndefined();
        expect(createDepositSchema.validate({
            amount: 100.25, referenceNumber: 'REF-1', requestId: 'deposit-1', destinationId: 1
        }).error).toBeUndefined();
        expect(createDepositSchema.validate({
            amount: 0, referenceNumber: 'REF-2', requestId: 'deposit-2', destinationId: 1
        }).error).toBeDefined();
    });

    test('aplica el mismo contrato monetario a settings financieros', () => {
        expect(settingsBodySchemas.financial_rules.validate({
            min_bet_per_number: 10.25
        }).error).toBeUndefined();
        expect(settingsBodySchemas.financial_rules.validate({
            min_bet_per_number: 10.257
        }).error).toBeDefined();
        expect(settingsBodySchemas.deposits_rules.validate({
            min_deposit: '100'
        }).error).toBeDefined();
    });

    test('rechaza jugadas repetidas y limita un ticket a 100 elementos', () => {
        const duplicate = createBetSchema.validate({
            request_id: 'duplicate-bet',
            bets: [
                { draw_id: 1, number_played: '05', amount: 10 },
                { draw_id: 1, number_played: '05', amount: 20 }
            ]
        });
        const oversized = createBetSchema.validate({
            request_id: 'oversized-bet',
            bets: Array.from({ length: 101 }, (_, index) => ({
                draw_id: index + 1,
                number_played: '05',
                amount: 10
            }))
        });

        expect(duplicate.error).toBeDefined();
        expect(oversized.error).toBeDefined();
    });
});

describe('resultados canónicos', () => {
    test('rechaza draw_id duplicados y limita la carga a 100 resultados', () => {
        const duplicate = loadResultsSchema.validate({
            results: [
                { draw_id: 1, winning_number: 5 },
                { draw_id: 1, winning_number: 6 }
            ]
        });
        const oversized = loadResultsSchema.validate({
            results: Array.from({ length: 101 }, (_, index) => ({
                draw_id: index + 1,
                winning_number: index % 100
            }))
        });

        expect(duplicate.error).toBeDefined();
        expect(oversized.error).toBeDefined();
    });

    test('normaliza el resultado 5 como 05 antes de persistir y emitir el evento', async () => {
        const drawSql = { saveResults: jest.fn().mockResolvedValue(true) };
        const eventBus = { emit: jest.fn() };

        await loadResultsService(
            drawSql,
            eventBus,
            10,
            [{ draw_id: 7, winning_number: 5 }],
            '127.0.0.1',
            'test-device'
        );

        expect(drawSql.saveResults).toHaveBeenCalledWith(
            10,
            [{ draw_id: 7, winning_number: '05' }],
            '127.0.0.1',
            'test-device'
        );
        expect(eventBus.emit).toHaveBeenCalledWith('draw.results_loaded', { drawIds: [7] });
    });
});
