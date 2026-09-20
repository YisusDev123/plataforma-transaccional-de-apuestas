import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { iniciarWalletController } from '../modules/wallet/wallet-controller.js';
import * as walletService from '../modules/wallet/wallet-services.js';

function settings(values) {
    return { get: jest.fn(key => values[key]) };
}

describe('reglas operativas del jugador', () => {
    test('publica mínimos, requisitos KYC y los dos destinos vigentes normalizados', async () => {
        const destinations = [{ id: 1, type: 'BANK_ACCOUNT' }, { id: 2, type: 'SINPE_MOVIL' }];
        const destinationDatabase = { obtenerDestinosVigentes: jest.fn().mockResolvedValue(destinations) };
        const result = await walletService.consultarReglasOperativas(settings({
            deposits_rules: { min_deposit: 1000, internal: 'hidden' },
            withdraws_rules: { min_withdrawal: '2500.5' },
            kyc_policies: { require_kyc_for_deposits: true, require_kyc_for_withdrawals: false }
        }), destinationDatabase);
        expect(result).toEqual({
            deposit: { minimum: '1000.00', requiresKyc: true, destinations },
            withdrawal: { minimum: '2500.50', requiresKyc: false }
        });
        expect(JSON.stringify(result)).not.toContain('internal');
    });

    test('falla de forma segura si las reglas no están cargadas', async () => {
        await expect(walletService.consultarReglasOperativas(settings({}), {}))
            .rejects.toThrow('No se pudieron obtener las reglas operativas.');
    });

    test('el controlador conserva el contrato success', async () => {
        const controller = iniciarWalletController(walletService, {}, settings({
            deposits_rules: { min_deposit: 100 },
            withdraws_rules: { min_withdrawal: 200 },
            kyc_policies: { require_kyc_for_deposits: true, require_kyc_for_withdrawals: true }
        }), { obtenerDestinosVigentes: jest.fn().mockResolvedValue([]) });
        const app = express();
        app.get('/wallet/operation-rules', (req, res, next) => {
            req.userId = 1;
            controller.getOperationRules(req, res, next);
        });
        const response = await request(app).get('/wallet/operation-rules');
        expect(response.status).toBe(200);
        expect(response.body.body.deposit.minimum).toBe('100.00');
        expect(response.body.body.deposit.destinations).toEqual([]);
    });
});
