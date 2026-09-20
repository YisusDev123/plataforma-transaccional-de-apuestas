import { describe, expect, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import {
    emailSchema,
    loginPasswordSchema,
    newPasswordSchema,
    plainTextSchema,
    refreshTokenSchema,
    requestIdSchema,
    sixDigitCodeSchema
} from '../schemas/common-schema.js';
import { refreshSessionSchema } from '../schemas/auth-schema.js';
import { validar } from '../shared/middleware/joi-schema.js';
import { sanitizeBody } from '../shared/utils/omitir.js';

describe('validadores compartidos de autenticación', () => {
    test('normaliza correo y rechaza longitudes superiores a 254', () => {
        const normalized = emailSchema.validate('  Usuario@Example.COM  ');
        const oversized = emailSchema.validate(`${'a'.repeat(245)}@example.com`);

        expect(normalized.error).toBeUndefined();
        expect(normalized.value).toBe('usuario@example.com');
        expect(oversized.error).toBeDefined();
    });

    test('preserva la contraseña y limita bcrypt a 72 bytes UTF-8', () => {
        const withSpaces = newPasswordSchema.validate('  clave segura  ');
        const seventyTwoBytes = newPasswordSchema.validate('á'.repeat(36));
        const seventyFourBytes = newPasswordSchema.validate('á'.repeat(37));

        expect(withSpaces.value).toBe('  clave segura  ');
        expect(seventyTwoBytes.error).toBeUndefined();
        expect(seventyFourBytes.error).toBeDefined();
        expect(loginPasswordSchema.validate('abc').error).toBeUndefined();
    });

    test('exige códigos de seis dígitos conservando ceros iniciales', () => {
        expect(sixDigitCodeSchema.validate('001234').value).toBe('001234');
        expect(sixDigitCodeSchema.validate('12345').error).toBeDefined();
        expect(sixDigitCodeSchema.validate('1234567').error).toBeDefined();
        expect(sixDigitCodeSchema.validate('12A456').error).toBeDefined();
    });

    test('exige refresh token hexadecimal de 80 caracteres', () => {
        expect(refreshTokenSchema.validate('a'.repeat(80)).error).toBeUndefined();
        expect(refreshTokenSchema.validate('a'.repeat(79)).error).toBeDefined();
        expect(refreshTokenSchema.validate('g'.repeat(80)).error).toBeDefined();
        expect(refreshTokenSchema.validate({ token: 'a'.repeat(80) }).error).toBeDefined();
    });
});

describe('identificadores y texto plano', () => {
    test('conserva requestId exactamente y rechaza espacios, HTML y controles', () => {
        const valid = 'Bet-Mobile:session_15.operation-3';

        expect(requestIdSchema.validate(valid).value).toBe(valid);
        expect(requestIdSchema.validate(' request-1 ').error).toBeDefined();
        expect(requestIdSchema.validate('<script>').error).toBeDefined();
        expect(requestIdSchema.validate('request\n1').error).toBeDefined();
    });

    test('plainText normaliza texto humano y rechaza markup y controles incluso en los extremos', () => {
        const schema = plainTextSchema({ min: 4, max: 50 });
        const decomposed = 'Jose\u0301 O\'Connor: revisión válida.';

        expect(schema.validate(decomposed)).toMatchObject({
            value: 'José O\'Connor: revisión válida.'
        });
        expect(schema.validate('<b>texto</b>').error).toBeDefined();
        expect(schema.validate('texto\u0000oculto').error).toBeDefined();
        expect(schema.validate('texto\n').error).toBeDefined();
        expect(schema.validate('\ttexto').error).toBeDefined();
    });

    test('plainText solo admite vacío y saltos de línea cuando se configuran', () => {
        const optionalMessage = plainTextSchema({ max: 20, allowEmpty: true });
        const multiline = plainTextSchema({ min: 1, max: 20, allowLineBreaks: true });

        expect(optionalMessage.validate('').error).toBeUndefined();
        expect(plainTextSchema().validate('').error).toBeDefined();
        expect(multiline.validate('línea 1\nlínea 2').error).toBeUndefined();
        expect(multiline.validate('línea\toculta').error).toBeDefined();
    });
});

describe('contrato HTTP de refresh token', () => {
    test('detiene cuerpos inválidos antes del controlador', async () => {
        const app = express();
        app.use(express.json());
        app.post('/refresh', validar(refreshSessionSchema), (req, res) => {
            res.status(200).json(req.body);
        });
        app.use((error, req, res, _next) => {
            res.status(error.statusCode || 500).json({ message: error.message });
        });

        const invalid = await request(app).post('/refresh').send({ refreshToken: 123 });
        const validToken = 'a'.repeat(80);
        const valid = await request(app).post('/refresh').send({ refreshToken: validToken });

        expect(invalid.status).toBe(400);
        expect(valid.status).toBe(200);
        expect(valid.body.refreshToken).toBe(validToken);
    });
});

describe('redacción de metadata sensible', () => {
    test('oculta secretos, códigos, documentos y cuentas recursivamente', () => {
        const sanitized = sanitizeBody({
            newPassword: 'secreto',
            verificationCode: '123456',
            resetCode: '654321',
            dni: '123456789',
            destinationAccount: 'CR001234',
            destinationAccountHolder: 'Persona Titular',
            withdrawal_account_snapshot: { cuenta: 'CR009999' },
            referenceNumber: 'BANK-123',
            safe: { requestId: 'operation-1' }
        });

        expect(sanitized).toEqual({
            newPassword: '[REDACTED]',
            verificationCode: '[REDACTED]',
            resetCode: '[REDACTED]',
            dni: '[REDACTED]',
            destinationAccount: '[REDACTED]',
            destinationAccountHolder: '[REDACTED]',
            withdrawal_account_snapshot: '[REDACTED]',
            referenceNumber: '[REDACTED]',
            safe: { requestId: 'operation-1' }
        });
    });
});
