import { describe, expect, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createDepositSchema } from '../schemas/deposits-schema.js';
import { requestWithdrawalSchema } from '../schemas/withdrawls-schema.js';
import {
    rejectDepositBodySchema,
    reviewKycBodySchema,
    suspendUserBodySchema
} from '../schemas/admin-schemas.js';
import { settingsBodySchemas, settingsParamSchema } from '../schemas/setting-schema.js';
import { validar, validarSettingsBody } from '../shared/middleware/joi-schema.js';

const validPayloads = {
    deposit: {
        amount: 100,
        referenceNumber: '  Referencia José O\'Connor  ',
        requestId: 'deposit-request-1',
        destinationId: 1
    },
    withdrawal: {
        amount: 100,
        destinationAccount: '  Cuenta principal: 001-002  ',
        destinationAccountHolder: '  José O\'Connor  ',
        requestId: 'withdrawal-request-1'
    },
    depositRejection: {
        reason: '  Comprobante ilegible; reenviar, por favor.  '
    },
    suspension: {
        userId: 10,
        reason: '  Revisión manual pendiente.  '
    },
    kycReview: {
        id: 20,
        status: 'APPROVED',
        detalles: '  Documento válido y legible.  '
    },
    systemStatus: {
        message: '  Sistema en revisión programada.  '
    }
};

const fieldCases = [
    ['referencia de depósito', createDepositSchema, validPayloads.deposit, 'referenceNumber', 255],
    ['cuenta destino', requestWithdrawalSchema, validPayloads.withdrawal, 'destinationAccount', 255],
    ['titular de cuenta destino', requestWithdrawalSchema, validPayloads.withdrawal, 'destinationAccountHolder', 255],
    ['rechazo de depósito', rejectDepositBodySchema, validPayloads.depositRejection, 'reason', 255],
    ['suspensión de usuario', suspendUserBodySchema, validPayloads.suspension, 'reason', 500],
    ['detalles KYC', reviewKycBodySchema, validPayloads.kycReview, 'detalles', 500],
    ['mensaje del sistema', settingsBodySchemas.system_status, validPayloads.systemStatus, 'message', 255]
];

describe('schemas de texto plano persistente', () => {
    test.each(fieldCases)('%s conserva texto legítimo y aplica NFC', (_name, schema, payload, field) => {
        const decomposed = '  Revisio\u0301n de José O\'Connor: válida.  ';
        const result = schema.validate({ ...payload, [field]: decomposed });

        expect(result.error).toBeUndefined();
        expect(result.value[field]).toBe('Revisión de José O\'Connor: válida.');
    });

    test.each(fieldCases)('%s rechaza markup y controles', (_name, schema, payload, field) => {
        expect(schema.validate({ ...payload, [field]: '<script>alert(1)</script>' }).error).toBeDefined();
        expect(schema.validate({ ...payload, [field]: 'texto válido\n' }).error).toBeDefined();
        expect(schema.validate({ ...payload, [field]: 'texto\u0000oculto' }).error).toBeDefined();
    });

    test.each(fieldCases)('%s respeta el límite máximo', (_name, schema, payload, field, max) => {
        expect(schema.validate({ ...payload, [field]: 'a'.repeat(max) }).error).toBeUndefined();
        expect(schema.validate({ ...payload, [field]: 'a'.repeat(max + 1) }).error).toBeDefined();
    });

    test('conserva contratos técnicos y permite vacío solo en el mensaje del sistema', () => {
        const deposit = createDepositSchema.validate(validPayloads.deposit);
        const withdrawal = requestWithdrawalSchema.validate(validPayloads.withdrawal);

        expect(deposit.value.amount).toBe(100);
        expect(deposit.value.requestId).toBe('deposit-request-1');
        expect(withdrawal.value.amount).toBe(100);
        expect(withdrawal.value.requestId).toBe('withdrawal-request-1');
        expect(settingsBodySchemas.system_status.validate({ message: '' }).error).toBeUndefined();
        expect(rejectDepositBodySchema.validate({ reason: '' }).error).toBeDefined();
    });
});

function createValidationApp() {
    const app = express();
    const respondWithBody = (req, res) => res.status(200).json(req.body);

    app.use(express.json());
    app.post('/deposits', validar(createDepositSchema), respondWithBody);
    app.post('/withdrawals', validar(requestWithdrawalSchema), respondWithBody);
    app.post('/admin/deposits/reject', validar(rejectDepositBodySchema), respondWithBody);
    app.patch('/admin/users/suspend', validar(suspendUserBodySchema), respondWithBody);
    app.patch('/admin/kyc/review', validar(reviewKycBodySchema), respondWithBody);
    app.patch(
        '/rules/:key',
        validar(settingsParamSchema, 'params'),
        validarSettingsBody(),
        respondWithBody
    );
    app.use((error, req, res, _next) => {
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message
        });
    });

    return app;
}

describe('contrato HTTP de texto plano persistente', () => {
    const routes = [
        ['post', '/deposits', validPayloads.deposit, 'referenceNumber'],
        ['post', '/withdrawals', validPayloads.withdrawal, 'destinationAccount'],
        ['post', '/withdrawals', validPayloads.withdrawal, 'destinationAccountHolder'],
        ['post', '/admin/deposits/reject', validPayloads.depositRejection, 'reason'],
        ['patch', '/admin/users/suspend', validPayloads.suspension, 'reason'],
        ['patch', '/admin/kyc/review', validPayloads.kycReview, 'detalles'],
        ['patch', '/rules/system_status', validPayloads.systemStatus, 'message']
    ];

    test.each(routes)('%s %s rechaza markup con 400', async (method, path, payload, field) => {
        const app = createValidationApp();
        const response = await request(app)[method](path)
            .send({ ...payload, [field]: '<img src=x onerror=alert(1)>' });

        expect(response.status).toBe(400);
        expect(response.type).toBe('application/json');
        expect(response.body).toEqual(expect.objectContaining({ success: false }));
        expect(response.body).not.toHaveProperty('stack');
        expect(response.body.message).not.toMatch(/SQL|SELECT|INSERT/i);
    });

    test.each(routes)('%s %s entrega texto normalizado al controlador', async (method, path, payload, field) => {
        const app = createValidationApp();
        const response = await request(app)[method](path)
            .send({ ...payload, [field]: '  Revisio\u0301n válida.  ', unknown: 'discarded' });

        expect(response.status).toBe(200);
        expect(response.body[field]).toBe('Revisión válida.');
        expect(response.body).not.toHaveProperty('unknown');
    });
});
