import { afterEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { notFoundHandler } from '../shared/middleware/not-found.js';
import { globalErrorHandler } from '../shared/error/globalErrors.js';
import { logger } from '../shared/error/winston.js';
import { crearApp } from '../../app.js';

describe('contrato JSON para rutas inexistentes', () => {
    test.each(['get', 'post', 'patch', 'delete'])('%s devuelve un 404 JSON seguro', async method => {
        const app = express();
        app.use(notFoundHandler);

        const response = await request(app)[method]('/ninguna?valor=prueba');

        expect(response.status).toBe(404);
        expect(response.type).toBe('application/json');
        expect(response.body).toEqual({
            success: false,
            code: 'ROUTE_NOT_FOUND',
            message: 'La ruta solicitada no existe'
        });
        expect(response.body).not.toHaveProperty('stack');
    });

    test('no intercepta rutas válidas declaradas antes del fallback', async () => {
        const app = express();
        app.get('/health-test', (req, res) => res.status(200).json({ ok: true }));
        app.use(notFoundHandler);

        const response = await request(app).get('/health-test');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ ok: true });
    });

    test('el fallback está registrado en la aplicación después de los routers', async () => {
        const response = await request(crearApp()).get('/ninguna');

        expect(response.status).toBe(404);
        expect(response.body.code).toBe('ROUTE_NOT_FOUND');
    });
});

describe('identidad autenticada en logs de errores', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test.each([
        ['administrador', { admin: { id: 7 } }, { type: 'ADMIN', id: 7 }],
        ['usuario', { userId: 12 }, { type: 'USER', id: 12 }],
        ['solicitud pública', {}, null]
    ])('registra correctamente al actor de tipo %s', (_name, identity, expectedActor) => {
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
        const error = new Error('Solicitud inválida');
        error.statusCode = 400;
        const req = {
            ...identity,
            originalUrl: '/ruta',
            method: 'POST',
            ip: '127.0.0.1',
            body: {
                password: 'secreto',
                dni: '123456789',
                safe: 'visible'
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        globalErrorHandler(error, req, res, jest.fn());

        const metadata = warn.mock.calls[0][1].metadata;
        expect(metadata.authenticatedActor).toEqual(expectedActor);
        expect(metadata.request_body).toEqual({
            password: '[REDACTED]',
            dni: '[REDACTED]',
            safe: 'visible'
        });
        expect(metadata).not.toHaveProperty('authenticatedUser');
    });
});
