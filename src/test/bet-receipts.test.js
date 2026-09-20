import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { applyBetReceiptsMigration } from '../shared/database/bet-receipts-migration.js';
import { iniciarBaseDeDatosBet } from '../shared/database/bet-sql.js';
import { createBetReceiptData } from '../modules/bets/bet-receipt.js';
import { renderBetReceiptPdf } from '../modules/bets/bet-receipt-pdf.js';
import { iniciarBetController } from '../modules/bets/bet-controller.js';
import { getAdminBetReceipt, getUserBetReceipt } from '../modules/bets/bet-service.js';
import { adminBetHistoryQuerySchema } from '../schemas/financial-history-schema.js';

function receipt(itemCount = 1) {
    return createBetReceiptData({
        acceptedAt: '2026-09-05 15:00:00',
        customerName: 'María José O\'Connor-López',
        ticketCode: '6E6F55BA64DE',
        totalAmount: String(itemCount * 10),
        items: Array.from({ length: itemCount }, (_, index) => ({
            drawId: 8,
            lottery: 'NICA',
            modality: index % 3 === 0 ? 'MEGA_REVENTADO' : 'NORMAL',
            drawDate: '2026-09-06',
            scheduleTime: '15:00:00',
            numberPlayed: String(index % 100).padStart(2, '0'),
            amount: '10.00',
            multiplier: '85.25'
        }))
    });
}

function storedReceiptData() {
    return {
        bet: {
            ticket_code: '6E6F55BA64DE',
            total_amount: '10.00',
            created_at: '2026-09-05 15:00:00',
            customer_name_snapshot: 'María José O\'Connor-López'
        },
        items: [{
            draw_id: 8,
            lottery: 'NICA',
            modality: 'NORMAL',
            draw_date: '2026-09-06',
            schedule_time: '15:00:00',
            number_played: '05',
            amount: '10.00',
            payout_multiplier_snapshot: '85.25'
        }]
    };
}

describe('comprobantes de apuestas generados bajo demanda', () => {
    test('normaliza únicamente los datos esenciales sin duplicar premios calculados', () => {
        expect(receipt()).toMatchObject({
            totalAmount: '10.00',
            acceptedAt: '2026-09-05T15:00:00.000Z',
            customer: { fullName: 'María José O\'Connor-López' },
            items: [{ amount: '10.00', multiplier: '85.25' }]
        });
        expect(receipt().items[0]).not.toHaveProperty('potentialPayout');
        expect(receipt()).not.toHaveProperty('schemaVersion');
    });

    test('no genera comprobantes históricos sin nombre ni apuestas sin jugadas', () => {
        expect(() => createBetReceiptData({
            acceptedAt: '2026-09-05T15:00:00Z', customerName: null,
            ticketCode: '6E6F55BA64DE', totalAmount: '10.00', items: [{}]
        })).toThrow();
        expect(() => createBetReceiptData({
            acceptedAt: '2026-09-05T15:00:00Z', customerName: 'Cliente',
            ticketCode: '6E6F55BA64DE', totalAmount: '10.00', items: []
        })).toThrow();
    });

    test('arma el comprobante de usuario y administrador desde filas normalizadas', async () => {
        const data = storedReceiptData();
        const betSql = {
            obtenerComprobanteUsuario: jest.fn().mockResolvedValue(data),
            obtenerComprobanteAdmin: jest.fn().mockResolvedValue(data)
        };
        const user = await getUserBetReceipt(betSql, 7, 9);
        const admin = await getAdminBetReceipt(betSql, 9);
        expect(user.receipt.items[0]).toEqual(expect.objectContaining({
            numberPlayed: '05', amount: '10.00', multiplier: '85.25'
        }));
        expect(admin.receipt.customer.fullName).toBe('María José O\'Connor-López');
        expect(betSql.obtenerComprobanteUsuario).toHaveBeenCalledWith(7, 9);
    });

    test('repositorio limita el comprobante del jugador por ownership antes de leer jugadas', async () => {
        const pool = { query: jest.fn().mockResolvedValueOnce([[]]) };
        const database = iniciarBaseDeDatosBet(pool, {});
        await expect(database.obtenerComprobanteUsuario(7, 9)).resolves.toBeNull();
        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(pool.query.mock.calls[0][0]).toContain('b.user_id = ?');
        expect(pool.query.mock.calls[0][0]).toContain('customer_name_snapshot');
        expect(pool.query.mock.calls[0][0]).not.toContain('receipt_snapshot');
        expect(pool.query.mock.calls[0][1]).toEqual([9, 7]);
    });

    test('genera un PDF válido de cinco páginas para cien jugadas', async () => {
        const pdf = await renderBetReceiptPdf(receipt(100));
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
        expect(pdf.length).toBeGreaterThan(9000);
        expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || [])).toHaveLength(5);
    });

    test('controlador entrega PDF privado después de consultar los datos autorizados', async () => {
        const services = {
            getUserBetReceipt: jest.fn().mockResolvedValue({
                ticketCode: '6E6F55BA64DE', receipt: receipt()
            })
        };
        const renderer = jest.fn().mockResolvedValue(Buffer.from('%PDF-test'));
        const controller = iniciarBetController(services, {}, {}, {}, renderer);
        const app = express();
        app.get('/bet/:id/receipt', (req, _res, next) => {
            req.userId = 7;
            req.validated = { params: { id: Number(req.params.id) } };
            next();
        }, controller.receipt);
        const response = await request(app).get('/bet/9/receipt').buffer(true);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('application/pdf');
        expect(response.headers['cache-control']).toContain('no-store');
        expect(response.headers['content-disposition']).toContain('comprobante-6E6F55BA64DE.pdf');
        expect(services.getUserBetReceipt).toHaveBeenCalledWith({}, 7, 9);
        expect(renderer).toHaveBeenCalledWith(expect.objectContaining({ ticketCode: '6E6F55BA64DE' }));
    });

    test('valida filtros y orden de fechas administrativos', () => {
        expect(adminBetHistoryQuerySchema.validate({ ticketCode: '6e6f55ba64de', dateFrom: '2026-09-01', dateTo: '2026-09-05' }).error).toBeUndefined();
        expect(adminBetHistoryQuerySchema.validate({ dateFrom: '2026-09-06', dateTo: '2026-09-05' }).error).toBeDefined();
        expect(adminBetHistoryQuerySchema.validate({ dateFrom: '05/09/2026' }).error).toBeDefined();
    });

    test('migración agrega el nombre mínimo y retira columnas JSON vacías', async () => {
        const connection = { query: jest.fn()
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([{ affectedRows: 0 }])
            .mockResolvedValueOnce([[{ total: 1 }]])
            .mockResolvedValueOnce([[{ total: 1 }]])
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([{ affectedRows: 0 }])
            .mockResolvedValueOnce([{ affectedRows: 0 }]) };
        await expect(applyBetReceiptsMigration(connection)).resolves.toEqual({
            changed: true,
            actions: [
                'add bets.customer_name_snapshot',
                'drop bets.receipt_version',
                'drop bets.receipt_snapshot'
            ]
        });
    });

    test('migración es idempotente y rechaza borrar snapshots JSON con datos', async () => {
        const existing = { query: jest.fn()
            .mockResolvedValueOnce([[{ total: 1 }]])
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[{ total: 0 }]]) };
        await expect(applyBetReceiptsMigration(existing)).resolves.toEqual({ changed: false, actions: [] });

        const legacy = { query: jest.fn()
            .mockResolvedValueOnce([[{ total: 1 }]])
            .mockResolvedValueOnce([[{ total: 1 }]])
            .mockResolvedValueOnce([[{ total: 1 }]])
            .mockResolvedValueOnce([[{ total: 2 }]]) };
        await expect(applyBetReceiptsMigration(legacy)).rejects.toMatchObject({
            code: 'LEGACY_BET_RECEIPTS_PRESENT', total: 2
        });
        expect(legacy.query).toHaveBeenCalledTimes(4);
    });
});
