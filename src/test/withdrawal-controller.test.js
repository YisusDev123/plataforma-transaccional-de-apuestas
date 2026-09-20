import { describe, expect, jest, test } from '@jest/globals';
import { iniciarWithdrawalsController } from '../modules/withdrawls/withdrawls-controller.js';

describe('withdrawalsController', () => {
    test('envía todos los campos validados al servicio', async () => {
        const servicioRetiro = {
            solicitarRetiro: jest.fn().mockResolvedValue({ id: 10, status: 'PENDING' })
        };
        const database = {};
        const usersDatabase = {};
        const settingsService = {};
        const controller = iniciarWithdrawalsController(
            servicioRetiro,
            database,
            usersDatabase,
            settingsService
        );
        const req = {
            userId: 7,
            body: {
                amount: 500,
                destinationAccount: 'Cuenta de prueba',
                destinationAccountHolder: 'Persona de Prueba',
                requestId: 'request-123'
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn()
        };
        const next = jest.fn();

        await controller.request(req, res, next);

        expect(servicioRetiro.solicitarRetiro).toHaveBeenCalledWith(
            database,
            usersDatabase,
            settingsService,
            7,
            {
                amount: '500',
                destinationAccount: 'Cuenta de prueba',
                destinationAccountHolder: 'Persona de Prueba',
                requestId: 'request-123'
            }
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(next).not.toHaveBeenCalled();
    });
});
