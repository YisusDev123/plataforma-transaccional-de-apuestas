import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import Joi from 'joi';
import request from 'supertest';
import { validar } from '../shared/middleware/joi-schema.js';
import { extraerPaginacion } from '../shared/middleware/paginacion.js';
import { paginationQuerySchema } from '../schemas/common-schema.js';
import { createPaginationMetadata } from '../shared/utils/pagination.js';
import {
    ObtenerAllUsersKyc,
    obtenerDepositosStatus,
    obtenerKycStatus,
    obtenerRetirosStatus
} from '../modules/admin/admin-services.js';

function createApp() {
    const app = express();
    const schema = paginationQuerySchema.concat(Joi.object({
        status: Joi.string().uppercase().valid('PENDING').required()
    }));

    app.get('/items', validar(schema, 'query'), extraerPaginacion, (req, res) => {
        res.json({
            query: req.validated.query,
            rawQuery: req.query,
            pagination: req.pagination
        });
    });
    app.use((error, req, res, _next) => {
        res.status(error.statusCode || 500).json({ message: error.message });
    });

    return app;
}

describe('validación de query en Express 5', () => {
    test('convierte paginación, conserva filtros y no elimina req.query', async () => {
        const app = createApp();
        const response = await request(app).get('/items?status=pending&page=2&limit=5');

        expect(response.status).toBe(200);
        expect(response.body.query).toEqual({ status: 'PENDING', page: 2, limit: 5 });
        expect(response.body.rawQuery).toEqual({ status: 'pending', page: '2', limit: '5' });
        expect(response.body.pagination).toEqual({ page: 2, limit: 5, offset: 5 });
    });

    test('usa defaults únicamente cuando page y limit están ausentes', async () => {
        const response = await request(createApp()).get('/items?status=PENDING');

        expect(response.status).toBe(200);
        expect(response.body.pagination).toEqual({ page: 1, limit: 10, offset: 0 });
    });

    test.each([
        'page=abc',
        'page=0',
        'page=1.5',
        'limit=0',
        'limit=101',
        'limit=texto'
    ])('rechaza query de paginación inválida: %s', async query => {
        const response = await request(createApp()).get(`/items?status=PENDING&${query}`);

        expect(response.status).toBe(400);
    });
});

describe('metadata y colecciones vacías', () => {
    test('crea metadata uniforme para totales positivos y vacíos', () => {
        expect(createPaginationMetadata({ totalItems: '21', page: 2, limit: 10 })).toEqual({
            totalItems: 21,
            currentPage: 2,
            totalPages: 3,
            limit: 10
        });
        expect(createPaginationMetadata({ totalItems: 0, page: 1, limit: 10 })).toEqual({
            totalItems: 0,
            currentPage: 1,
            totalPages: 0,
            limit: 10
        });
    });

    test.each([
        ['KYC', obtenerKycStatus, 'obtenerKycPorStatus', [1, 'PENDING', 10, 0], 'solicitudes'],
        ['depósitos', obtenerDepositosStatus, 'obtenerDepositosPorStatus', [1, 'PENDING', 10, 0], 'deposits'],
        ['retiros', obtenerRetirosStatus, 'obtenerRetirosPorStatus', [1, 'PENDING', 10, 0], 'withdrawals'],
        ['usuarios', ObtenerAllUsersKyc, 'obtenerTodosUsuariosConKyc', [10, 0], 'users']
    ])('%s devuelve una colección vacía sin lanzar 404', async (_name, service, method, args, field) => {
        const repository = {
            [method]: jest.fn().mockResolvedValue({ rows: [], total: 0 })
        };

        const result = await service(repository, ...args);

        expect(result[field]).toEqual([]);
        expect(result.total).toBe(0);
    });
});
