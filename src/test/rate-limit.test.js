import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import {
    adminRateLimitKey,
    crearRateLimiter,
    superAdminOperationLimiter,
    superAdminReadLimiter,
    userRateLimitKey
} from '../shared/middleware/rate-limit.js';

function crearAppDePrueba(limiter, handler) {
    const app = express();
    app.use(express.json());
    app.post('/operation', (req, res, next) => {
        if (req.headers['x-user-id']) req.userId = req.headers['x-user-id'];
        if (req.headers['x-admin-id']) req.admin = { id: req.headers['x-admin-id'] };
        next();
    }, limiter, handler);
    return app;
}

describe('rate limits específicos', () => {
    test('aísla contadores por userId aunque los usuarios compartan IP', async () => {
        const controller = jest.fn((req, res) => res.status(200).json({ ok: true }));
        const limiter = crearRateLimiter({
            windowMs: 60_000,
            max: 1,
            identifier: 'test-user',
            keyGenerator: userRateLimitKey
        });
        const app = crearAppDePrueba(limiter, controller);

        const firstUser = await request(app).post('/operation').set('x-user-id', '10');
        const blockedUser = await request(app).post('/operation').set('x-user-id', '10');
        const secondUser = await request(app).post('/operation').set('x-user-id', '11');

        expect(firstUser.status).toBe(200);
        expect(blockedUser.status).toBe(429);
        expect(blockedUser.body).toEqual({
            success: false,
            code: 'RATE_LIMITED',
            message: 'Has realizado demasiadas solicitudes. Intenta nuevamente más tarde.'
        });
        expect(blockedUser.headers).toHaveProperty('ratelimit-policy');
        expect(secondUser.status).toBe(200);
        expect(controller).toHaveBeenCalledTimes(2);
    });

    test('aísla contadores administrativos por adminId', async () => {
        const limiter = crearRateLimiter({
            windowMs: 60_000,
            max: 1,
            identifier: 'test-admin',
            keyGenerator: adminRateLimitKey
        });
        const app = crearAppDePrueba(limiter, (req, res) => res.sendStatus(204));

        await request(app).post('/operation').set('x-admin-id', '20');
        const blockedAdmin = await request(app).post('/operation').set('x-admin-id', '20');
        const otherAdmin = await request(app).post('/operation').set('x-admin-id', '21');

        expect(blockedAdmin.status).toBe(429);
        expect(otherAdmin.status).toBe(204);
    });

    test('skipSuccessfulRequests conserva la cuota y cuenta intentos fallidos', async () => {
        const limiter = crearRateLimiter({
            windowMs: 60_000,
            max: 1,
            identifier: 'test-login',
            skipSuccessfulRequests: true
        });
        const app = crearAppDePrueba(limiter, (req, res) => {
            if (req.body.fail) return res.status(401).json({ success: false });
            res.status(200).json({ success: true });
        });

        const successfulOne = await request(app).post('/operation').send({ fail: false });
        const successfulTwo = await request(app).post('/operation').send({ fail: false });
        const failedAttempt = await request(app).post('/operation').send({ fail: true });
        const blockedAttempt = await request(app).post('/operation').send({ fail: true });

        expect(successfulOne.status).toBe(200);
        expect(successfulTwo.status).toBe(200);
        expect(failedAttempt.status).toBe(401);
        expect(blockedAttempt.status).toBe(429);
    });

    test('usa la IP como respaldo cuando todavía no existe identidad autenticada', () => {
        const userKey = userRateLimitKey({ ip: '127.0.0.1' });
        const adminKey = adminRateLimitKey({ ip: '127.0.0.1' });

        expect(userKey).toMatch(/^ip:/);
        expect(adminKey).toMatch(/^ip:/);
    });

    test('saturar lecturas SUPER_ADMIN no consume la cuota de escrituras sensibles', async () => {
        const app = express();
        const identify = (req, res, next) => {
            req.admin = { id: 'rate-limit-independent-901' };
            next();
        };
        app.get('/read', identify, superAdminReadLimiter, (req, res) => res.sendStatus(204));
        app.patch('/write', identify, superAdminOperationLimiter, (req, res) => res.sendStatus(204));

        for (let attempt = 0; attempt < 120; attempt += 1) {
            expect((await request(app).get('/read')).status).toBe(204);
        }

        expect((await request(app).get('/read')).status).toBe(429);
        expect((await request(app).patch('/write')).status).toBe(204);
    });
});
