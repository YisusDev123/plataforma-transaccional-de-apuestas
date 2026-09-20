import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { iniciarControlador } from '../modules/auth/auth-controller.js';
import { iniciarAdminController } from '../modules/admin/admin-controller.js';
import { listBetHistory, getBetDetail } from '../modules/bets/bet-service.js';
import { listarDepositos, obtenerDeposito } from '../modules/deposits/deposits-services.js';
import { listarRetiros, maskAccount, obtenerRetiro } from '../modules/withdrawls/withdrawls-service.js';
import { iniciarBaseDeDatosDeposits } from '../shared/database/deposits-sql.js';
import { iniciarBaseDeDatosWithdrawals } from '../shared/database/withdrawls-sql.js';

function controllerApp(controller, routes) {
    const app = express();
    app.use(express.json());
    routes(app, controller);
    app.use((error, req, res, _next) => res.status(error.statusCode || 500).json({
        code: error.publicCode, message: error.message
    }));
    return app;
}

describe('sesiones web HttpOnly', () => {
    test('login y refresh de usuario no exponen el refresh token en JSON', async () => {
        const service = {
            login: jest.fn().mockResolvedValue({ accessToken: 'access-1', refreshToken: 'a'.repeat(80), user: { id: 1 } }),
            refrescarToken: jest.fn().mockResolvedValue({ accessToken: 'access-2', refreshToken: 'b'.repeat(80) }),
            logout: jest.fn().mockResolvedValue({ message: 'ok' })
        };
        const controller = iniciarControlador(service, {});
        const app = controllerApp(controller, (router, handlers) => {
            router.post('/login', handlers.login);
            router.post('/refresh', handlers.refresh);
            router.post('/logout', handlers.logout);
        });
        const login = await request(app).post('/login').send({ email: 'a@example.com', password: 'secret' });
        const cookie = login.headers['set-cookie'][0];
        expect(login.body.body.refreshToken).toBeUndefined();
        expect(cookie).toContain('lottery_user_refresh=');
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Lax');

        const refresh = await request(app).post('/refresh').set('Cookie', cookie.split(';')[0]).send({});
        expect(refresh.body.body).toEqual({ accessToken: 'access-2' });
        expect(service.refrescarToken).toHaveBeenCalledWith({}, 'a'.repeat(80), expect.any(String), expect.any(String));
    });

    test('administrador instala cookie separada y publica perfil', async () => {
        const service = {
            login: jest.fn().mockResolvedValue({ accessToken: 'access', token: 'access', refreshToken: 'c'.repeat(80), admin: { id: 2 } }),
            obtenerPerfilAdmin: jest.fn().mockResolvedValue({ id: 2, role: 'EMPLOYEE' })
        };
        const controller = iniciarAdminController(service, {});
        const app = controllerApp(controller, (router, handlers) => {
            router.post('/login', handlers.login);
            router.get('/me', (req, res, next) => { req.admin = { id: 2 }; next(); }, handlers.me);
        });
        const login = await request(app).post('/login').send({ email: 'admin@example.com', password: 'secret' });
        expect(login.body.body.refreshToken).toBeUndefined();
        expect(login.headers['set-cookie'][0]).toContain('lottery_admin_refresh=');
        expect((await request(app).get('/me')).body.body.role).toBe('EMPLOYEE');
    });
});

describe('contratos financieros de lectura', () => {
    test('historial de apuestas conserva importes y pago acreditado', async () => {
        const repository = { listarApuestasUsuario: jest.fn().mockResolvedValue({ total: 1, rows: [{
            id: 3, ticket_code: 'ABC', request_id: 'r1', total_amount: '10.00', status: 'WON',
            item_count: '1', total_payout: '900.00', total_refunded: '0.00', created_at: '2026-09-01 00:00:00'
        }] }) };
        const result = await listBetHistory(repository, 1, {}, 10, 0);
        expect(result.tickets[0]).toEqual(expect.objectContaining({ totalAmount: '10.00', totalPayout: '900.00' }));
        expect(repository.listarApuestasUsuario).toHaveBeenCalledWith(1, {}, 10, 0);
    });

    test('detalle ajeno o inexistente se representa como 404', async () => {
        await expect(getBetDetail({ obtenerApuestaUsuario: jest.fn().mockResolvedValue(null) }, 1, 99))
            .rejects.toMatchObject({ statusCode: 404 });
    });

    test('depósitos muestran motivo y retiros enmascaran la cuenta', async () => {
        const deposits = await listarDepositos({ listarDepositosUsuario: jest.fn().mockResolvedValue({ total: 1, rows: [{
            id: 1, amount: '100', reference_number: 'REF', request_id: 'd1', status: 'REJECTED',
            rejection_reason: 'Referencia inválida', reviewed_at: null, created_at: '2026-09-01'
        }] }) }, 1, {}, 10, 0);
        expect(deposits.deposits[0]).toEqual(expect.objectContaining({ amount: '100.00', rejectionReason: 'Referencia inválida' }));
        expect(maskAccount('1234567890')).toBe('******7890');

        const withdrawals = await listarRetiros({ listarRetirosUsuario: jest.fn().mockResolvedValue({ total: 1, rows: [{
            id: 2, amount: '50.00', request_id: 'w1', withdrawal_account_snapshot: JSON.stringify({ cuenta: '1234567890', titular: 'Persona Titular' }),
            status: 'PENDING', created_at: '2026-09-01'
        }] }) }, 1, {}, 10, 0);
        expect(withdrawals.withdrawals[0].destinationAccount).toBe('******7890');
        expect(withdrawals.withdrawals[0].destinationAccountHolder).toBe('Persona Titular');
        await expect(obtenerDeposito({ obtenerDepositoUsuario: jest.fn().mockResolvedValue(null) }, 1, 99)).rejects.toMatchObject({ statusCode: 404 });
        await expect(obtenerRetiro({ obtenerRetiroUsuario: jest.fn().mockResolvedValue(null) }, 1, 99)).rejects.toMatchObject({ statusCode: 404 });
    });
});

describe('idempotencia ligada al propietario y payload', () => {
    test('depósito rechaza requestId perteneciente a otro usuario', async () => {
        const connection = {
            beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
            query: jest.fn().mockResolvedValueOnce([[{
                id: 7, user_id: 2, amount: '100.00', reference_number: 'REF', status: 'PENDING'
            }]])
        };
        const repository = iniciarBaseDeDatosDeposits({ getConnection: jest.fn().mockResolvedValue(connection) });
        await expect(repository.crearDepositoTransaccional(1, 100, 'REF', 'same'))
            .rejects.toMatchObject({ statusCode: 409, publicCode: 'IDEMPOTENCY_KEY_CONFLICT' });
    });

    test('retiro rechaza reutilizar requestId con payload diferente', async () => {
        const pool = { query: jest.fn().mockResolvedValueOnce([[{
            id: 8, user_id: 1, amount: '50.00', withdrawal_account_snapshot: JSON.stringify({ cuenta: 'A', titular: 'Persona Original' }), status: 'PENDING'
        }]]) };
        const repository = iniciarBaseDeDatosWithdrawals(pool);
        await expect(repository.crearRetiroTransaccional(1, '50', 'A', 'Otra Persona', 'same'))
            .rejects.toMatchObject({ statusCode: 409, publicCode: 'IDEMPOTENCY_PAYLOAD_MISMATCH' });
    });
});
