import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { iniciarPayoutRuleSql } from '../shared/database/payout-rule-sql.js';
import { iniciarPayoutRuleService } from '../modules/payout-rules/payout-rule-services.js';
import { applyPayoutRulesMigration } from '../shared/database/payout-rules-migration.js';
import { calculatePayoutCents } from '../shared/utils/decimal-money.js';
import { updatePayoutRuleSchema } from '../schemas/payout-rule-schema.js';
import { iniciarPayoutRuleController } from '../modules/payout-rules/payout-rule-controller.js';

function updateConnection({ version = 3, updateAffected = 1, auditAffected = 1 } = {}) {
    return {
        beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
        query: jest.fn()
            .mockResolvedValueOnce([[{ id: 4, lottery: 'NICA', modality: 'NORMAL', multiplier: '85.00', is_active: 1, version }]])
            .mockResolvedValueOnce([{ affectedRows: updateAffected }])
            .mockResolvedValueOnce([{ affectedRows: auditAffected }])
    };
}

describe('gestión de multiplicadores', () => {
    test('el controlador HTTP conserva el envelope público y la identidad autenticada', async () => {
        const service = {
            list: jest.fn().mockResolvedValue([{ id: 4 }]),
            update: jest.fn().mockResolvedValue({ id: 4, multiplier: '90.25', version: 4 })
        };
        const controller = iniciarPayoutRuleController(service);
        const app = express();
        app.use(express.json());
        app.get('/rules', controller.list);
        app.patch('/rules/:id', (req, _res, next) => {
            req.admin = { id: 9 };
            req.validated = { params: { id: Number(req.params.id) }, body: req.body };
            next();
        }, controller.update);

        expect((await request(app).get('/rules')).body).toMatchObject({ error: false, body: { rules: [{ id: 4 }] } });
        const response = await request(app).patch('/rules/4').send({ multiplier: 90.25, expected_version: 3 });
        expect(response.status).toBe(200);
        expect(service.update).toHaveBeenCalledWith(expect.objectContaining({ adminId: 9, id: 4, multiplier: 90.25, expectedVersion: 3 }));
        expect(response.body.body.rule).toMatchObject({ multiplier: '90.25', version: 4 });
    });

    test('valida multiplicador positivo, decimal y versión esperada', () => {
        expect(updatePayoutRuleSchema.validate({ multiplier: 90.25, expected_version: 2 }).error).toBeUndefined();
        expect(updatePayoutRuleSchema.validate({ multiplier: 90.257, expected_version: 2 }).error).toBeDefined();
        expect(updatePayoutRuleSchema.validate({ multiplier: '90.25', expected_version: 2 }).error).toBeDefined();
        expect(updatePayoutRuleSchema.validate({ multiplier: 0, expected_version: 2 }).error).toBeDefined();
    });

    test('actualiza con bloqueo, versión y auditoría en una sola transacción', async () => {
        const connection = updateConnection();
        const sql = iniciarPayoutRuleSql({ getConnection: jest.fn().mockResolvedValue(connection) });
        const result = await sql.update({ adminId: 9, id: 4, multiplier: 90.25, expectedVersion: 3, ip: '127.0.0.1', device: 'test' });

        expect(connection.query.mock.calls[0][0]).toContain('FOR UPDATE');
        expect(connection.query.mock.calls[1]).toEqual(expect.arrayContaining([expect.stringContaining('version = version + 1'), ['90.25', 4, 3]]));
        expect(connection.query.mock.calls[2][0]).toContain('UPDATE_PAYOUT_RULE');
        expect(connection.commit).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ multiplier: '90.25', version: 4 });
    });

    test('rechaza una versión obsoleta y revierte sin escribir', async () => {
        const connection = updateConnection({ version: 4 });
        const sql = iniciarPayoutRuleSql({ getConnection: jest.fn().mockResolvedValue(connection) });

        await expect(sql.update({ adminId: 9, id: 4, multiplier: 90, expectedVersion: 3, ip: '127.0.0.1', device: 'test' }))
            .rejects.toMatchObject({ statusCode: 409, publicCode: 'PAYOUT_RULE_CHANGED' });
        expect(connection.query).toHaveBeenCalledTimes(1);
        expect(connection.rollback).toHaveBeenCalledTimes(1);
    });

    test('un fallo de auditoría revierte también el multiplicador', async () => {
        const connection = updateConnection({ auditAffected: 0 });
        const sql = iniciarPayoutRuleSql({ getConnection: jest.fn().mockResolvedValue(connection) });

        await expect(sql.update({ adminId: 9, id: 4, multiplier: 90, expectedVersion: 3, ip: '127.0.0.1', device: 'test' })).rejects.toThrow();
        expect(connection.commit).not.toHaveBeenCalled();
        expect(connection.rollback).toHaveBeenCalledTimes(1);
    });

    test('el servicio impide un premio fuera del rango monetario seguro', async () => {
        const repository = { update: jest.fn() };
        const service = iniciarPayoutRuleService(repository, { get: () => ({ max_ticket_total: Number.MAX_SAFE_INTEGER / 100 }) });
        await expect(service.update({ multiplier: 2 })).rejects.toMatchObject({ statusCode: 400, publicCode: 'PAYOUT_MULTIPLIER_UNSAFE' });
        expect(repository.update).not.toHaveBeenCalled();
    });

    test('calcula premios decimales en enteros con redondeo a centavos', () => {
        expect(calculatePayoutCents('10.01', '85.25')).toBe(85335);
        expect(calculatePayoutCents('0.01', '1.50')).toBe(2);
    });

    test('la migración agrega version una sola vez', async () => {
        const missing = { query: jest.fn().mockResolvedValueOnce([[{ total: 0 }]]).mockResolvedValueOnce([{ affectedRows: 0 }]) };
        await expect(applyPayoutRulesMigration(missing)).resolves.toEqual({ changed: true, actions: ['payout_rules.version'] });
        expect(missing.query.mock.calls[1][0]).toContain('ADD COLUMN version');

        const existing = { query: jest.fn().mockResolvedValueOnce([[{ total: 1 }]]) };
        await expect(applyPayoutRulesMigration(existing)).resolves.toEqual({ changed: false, actions: [] });
        expect(existing.query).toHaveBeenCalledTimes(1);
    });
});
