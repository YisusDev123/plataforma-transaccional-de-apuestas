import { afterEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { requireHttps } from '../shared/middleware/require-https.js';
import { globalErrorHandler } from '../shared/error/globalErrors.js';
import { configureHttpServer } from '../config/http-server.js';
import { createFatalErrorHandler } from '../config/process-errors.js';
import { createGracefulShutdown } from '../config/shutdown.js';
import { runProductionCheck } from '../config/production-check.js';
import { runSmokeTest } from '../config/smoke-test.js';
import { logger } from '../shared/error/winston.js';
import {
    REQUIRED_COLUMNS,
    REQUIRED_QUERY_INDEXES,
    REQUIRED_TABLES,
    REQUIRED_UNIQUE_INDEXES
} from '../config/database-contract.js';

afterEach(() => {
    jest.restoreAllMocks();
});

function httpsApp(enabled, trustProxy) {
    const app = express();
    app.set('trust proxy', trustProxy);
    app.use(requireHttps({ app: { requireHttps: enabled } }));
    app.get('/resource', (req, res) => res.json({ ok: true }));
    app.use(globalErrorHandler);
    return app;
}

describe('controles HTTP de producción', () => {
    test('permite HTTP cuando la exigencia está desactivada', async () => {
        expect((await request(httpsApp(false, false)).get('/resource')).status).toBe(200);
    });

    test('rechaza HTTP y acepta HTTPS informado por el proxy confiable', async () => {
        jest.spyOn(logger, 'warn').mockImplementation(() => {});
        const app = httpsApp(true, 1);
        const denied = await request(app).get('/resource');
        const accepted = await request(app).get('/resource').set('X-Forwarded-Proto', 'https');
        expect(denied.status).toBe(426);
        expect(denied.body.code).toBe('HTTPS_REQUIRED');
        expect(accepted.status).toBe(200);
    });

    test('aplica timeouts explícitos al servidor', () => {
        const server = {};
        configureHttpServer(server, {
            requestTimeoutMs: 15000,
            headersTimeoutMs: 10000,
            keepAliveTimeoutMs: 5000
        });
        expect(server).toEqual(expect.objectContaining({
            requestTimeout: 15000, headersTimeout: 10000, keepAliveTimeout: 5000
        }));
    });
});

describe('fallos fatales', () => {
    test('cierra una sola vez con código 1 sin registrar mensajes sensibles', async () => {
        const exit = jest.fn();
        const shutdown = createGracefulShutdown({
            getServer: () => null,
            stopJobs: jest.fn(), closeDatabase: jest.fn(), exit
        });
        const log = jest.fn();
        const fatal = createFatalErrorHandler({ shutdown, log });
        const error = Object.assign(new Error('password=secret-value'), { code: 'SIMULATED_FAILURE' });
        await expect(fatal('unhandledRejection', error)).resolves.toBe(true);
        await expect(fatal('uncaughtException', error)).resolves.toBe(false);
        expect(exit).toHaveBeenCalledWith(1);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log.mock.calls[0][0]).toContain('SIMULATED_FAILURE');
        expect(log.mock.calls[0][0]).not.toContain('secret-value');
    });
});

function productionCheckPool(dangerousGrants = false) {
    const tables = [...REQUIRED_TABLES];
    const columns = [...REQUIRED_COLUMNS];
    const indexes = REQUIRED_UNIQUE_INDEXES
        .map(([tableName, indexColumns]) => ({ tableName, columns: indexColumns, nonUnique: 0 }));
    indexes.push(...REQUIRED_QUERY_INDEXES
        .map(([tableName, indexColumns]) => ({ tableName, columns: indexColumns, nonUnique: 1 })));
    const settings = ['system_status', 'financial_rules', 'draw_defaults', 'kyc_policies', 'deposits_rules', 'withdraws_rules']
        .map(setting_key => ({
            setting_key,
            setting_value: setting_key === 'draw_defaults'
                ? JSON.stringify({ default_risk_limit: 3000, auto_close_minutes_before: 10 })
                : '{}'
        }));
    const connection = {
        query: jest.fn().mockResolvedValueOnce([[{ acquired: 1 }]]).mockResolvedValueOnce([[{ released: 1 }]]),
        release: jest.fn()
    };
    return {
        query: jest.fn(async sql => {
            if (sql.includes('@@session.time_zone')) return [[{
                sessionTimeZone: '+00:00', lockWaitTimeoutSeconds: 5, maxExecutionTimeMs: 8000
            }]];
            if (sql.includes('information_schema.tables')) return [tables.map(tableName => ({ tableName }))];
            if (sql.includes('character_maximum_length')) return [[
                { tableName: 'email_verifications', columnName: 'verification_code', maximumLength: 64 },
                { tableName: 'password_resets', columnName: 'reset_code', maximumLength: 64 }
            ]];
            if (sql.includes('information_schema.columns')) return [columns.map(columnName => ({ columnName }))];
            if (sql.includes('information_schema.statistics')) return [indexes];
            if (sql.includes('FROM settings')) return [settings];
            if (sql.includes('AS invalidPendingClose')) return [[{ invalidPendingClose: 0 }]];
            if (sql.includes('SHOW GRANTS')) return [[{ Grants: dangerousGrants ? 'GRANT ALL PRIVILEGES ON *.*' : 'GRANT SELECT, INSERT, UPDATE, DELETE' }]];
            throw new Error('unexpected query');
        }),
        getConnection: jest.fn().mockResolvedValue(connection)
    };
}

const checkConfig = {
    app: { environment: 'test', release: 'test', processRole: 'all' },
    mysql: {
        connectionLimit: 20, queueLimit: 50, acquireTimeoutMs: 1000,
        queryTimeoutMs: 8000, lockWaitTimeoutSeconds: 5
    }
};

describe('preflight de producción', () => {
    test('aprueba esquema, settings, locks y pool compatibles', async () => {
        const report = await runProductionCheck({ pool: productionCheckPool(), config: checkConfig });
        expect(report.success).toBe(true);
        expect(report.checks.every(item => item.passed)).toBe(true);
    });

    test('trata permisos amplios como warning en test y error en producción', async () => {
        const testReport = await runProductionCheck({ pool: productionCheckPool(true), config: checkConfig });
        const productionReport = await runProductionCheck({
            pool: productionCheckPool(true),
            config: { ...checkConfig, app: { environment: 'production', release: 'release-1' } }
        });
        expect(testReport.success).toBe(true);
        expect(testReport.warnings).toHaveLength(1);
        expect(productionReport.success).toBe(false);
    });

    test('rechaza un pool menor a tres conexiones cuando el proceso acredita premios', async () => {
        const report = await runProductionCheck({
            pool: productionCheckPool(),
            config: { ...checkConfig, mysql: { ...checkConfig.mysql, connectionLimit: 2 } }
        });
        expect(report.success).toBe(false);
        expect(report.checks.find(item => item.name === 'pool_limits')?.passed).toBe(false);
    });
});

function jsonResponse(status, body, headers = {}) {
    return new Response(JSON.stringify(body), {
        status, headers: { 'Content-Type': 'application/json', ...headers }
    });
}

describe('smoke test de producción', () => {
    test('valida salud, protecciones, versión, CORS y lectura autenticada', async () => {
        const fetchImpl = jest.fn(async (url, options = {}) => {
            const path = new URL(url).pathname;
            if (path === '/health/live') return jsonResponse(200, { status: 'alive' }, options.headers?.Origin ? { 'Access-Control-Allow-Origin': options.headers.Origin } : {});
            if (path === '/health/ready') return jsonResponse(200, { status: 'ready' });
            if (path === '/smoke-route-that-does-not-exist') return jsonResponse(404, { code: 'ROUTE_NOT_FOUND' });
            if (path === '/internal/version') return jsonResponse(200, { data: { release: 'release-1' } });
            if (path === '/internal/metrics' && !options.headers) return jsonResponse(401, {});
            if (path === '/internal/metrics') return jsonResponse(200, { data: { mysqlPool: {} } });
            if (path === '/draw/open') return jsonResponse(200, { body: [] });
            throw new Error('unexpected url');
        });
        const report = await runSmokeTest({
            baseUrl: 'https://api.lottery.example', environment: 'production',
            observabilityToken: 'token', userToken: 'user-token',
            allowedOrigin: 'https://app.lottery.example', fetchImpl
        });
        expect(report.success).toBe(true);
        expect(report.checks).toHaveLength(8);
    });

    test('rechaza HTTP como destino en producción', async () => {
        await expect(runSmokeTest({
            baseUrl: 'http://api.lottery.example', environment: 'production',
            observabilityToken: 'token', fetchImpl: jest.fn()
        })).rejects.toThrow('SMOKE_REQUIRES_HTTPS');
    });
});
