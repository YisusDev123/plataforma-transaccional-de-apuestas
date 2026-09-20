import { describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { correlationId } from '../shared/middleware/correlation-id.js';
import { createMetricsRegistry } from '../shared/observability/metrics.js';
import { createPoolMetrics } from '../shared/observability/pool-metrics.js';
import { createJobStateRegistry } from '../shared/observability/job-state.js';
import { createDatabaseReadinessCheck, createObservabilityRouter } from '../shared/observability/routes.js';
import { withMysqlLock } from '../shared/database/distributed-lock.js';
import { globalErrorHandler } from '../shared/error/globalErrors.js';
import { runLoadTest } from './load/isolated-http-load.js';
import { createGracefulShutdown } from '../config/shutdown.js';

const runtimeConfig = {
    app: { processRole: 'api', release: 'test-release', environment: 'test' },
    mysql: {
        connectionLimit: 20, queueLimit: 50, acquireTimeoutMs: 1000,
        queryTimeoutMs: 8000, lockWaitTimeoutSeconds: 5
    },
    security: { observabilityToken: 'test-observability-token-with-more-than-32-bytes' }
};

function observabilityApp(overrides = {}) {
    const metricsRegistry = createMetricsRegistry();
    const app = express();
    app.use(correlationId);
    app.use(metricsRegistry.middleware);
    app.use(createObservabilityRouter({
        pool: { query: jest.fn().mockResolvedValue([[{ ok: 1 }]]) },
        poolMetrics: { snapshot: () => ({ activeConnections: 0, queuedRequests: 0 }) },
        settingsService: { getAll: () => ({ system_status: {} }) },
        jobsOrquestador: {
            estaIniciado: () => false,
            obtenerEstado: () => [],
            obtenerAlertas: async () => ({ incompleteDraws: 0, delayedPayouts: 0, stoppedJobs: [] })
        },
        metricsRegistry,
        runtimeConfig,
        ...overrides
    }));
    app.get('/fail', (req, res, next) => next(new Error('Queue limit reached.')));
    app.use(globalErrorHandler);
    return app;
}

describe('observabilidad operativa', () => {
    test('conserva un correlation ID seguro y reemplaza uno inválido', async () => {
        const app = observabilityApp();
        const accepted = await request(app).get('/health/live').set('X-Correlation-Id', 'request-12345678');
        const replaced = await request(app).get('/health/live').set('X-Correlation-Id', '<script>');

        expect(accepted.headers['x-correlation-id']).toBe('request-12345678');
        expect(replaced.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    test('separa liveness de readiness y no expone errores internos', async () => {
        const pool = { query: jest.fn().mockRejectedValue(new Error('secret db host')) };
        const app = observabilityApp({ pool });

        expect((await request(app).get('/health/live')).status).toBe(200);
        const ready = await request(app).get('/health/ready');
        expect(ready.status).toBe(503);
        expect(ready.body.components.database).toBe('unavailable');
        expect(JSON.stringify(ready.body)).not.toContain('secret db host');
        expect(ready.headers['cache-control']).toBe('no-store');
    });

    test('readiness comparte una consulta concurrente y reutiliza el resultado por un TTL corto', async () => {
        let resolveQuery;
        let now = 1000;
        const pool = { query: jest.fn(() => new Promise(resolve => { resolveQuery = resolve; })) };
        const check = createDatabaseReadinessCheck(pool, { ttlMs: 1500, now: () => now });

        const first = check();
        const second = check();
        resolveQuery([[{ ok: 1 }]]);
        await expect(first).resolves.toBe(true);
        await expect(second).resolves.toBe(true);
        now = 2000;
        await expect(check()).resolves.toBe(true);
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('protege métricas y reporta HTTP, pool, jobs y alertas', async () => {
        const app = observabilityApp();
        expect((await request(app).get('/internal/metrics')).status).toBe(401);

        const response = await request(app)
            .get('/internal/metrics')
            .set('X-Observability-Token', runtimeConfig.security.observabilityToken);
        expect(response.status).toBe(200);
        expect(response.body.data.mysqlPool.limits).toEqual({
            connections: 20, queue: 50, acquireTimeoutMs: 1000,
            queryTimeoutMs: 8000, lockWaitTimeoutSeconds: 5
        });
        expect(response.body.data).toEqual(expect.objectContaining({ http: expect.any(Object), jobs: [], alerts: expect.any(Object) }));
    });

    test('protege y reporta la version interna sin exponer secretos', async () => {
        const app = observabilityApp();
        expect((await request(app).get('/internal/version')).status).toBe(401);

        const response = await request(app)
            .get('/internal/version')
            .set('X-Observability-Token', runtimeConfig.security.observabilityToken);
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(expect.objectContaining({
            release: 'test-release', environment: 'test', role: 'api', startedAt: expect.any(String)
        }));
        expect(JSON.stringify(response.body)).not.toContain(runtimeConfig.security.observabilityToken);
    });

    test('convierte saturación del pool en un 503 controlado', async () => {
        const response = await request(observabilityApp()).get('/fail');
        expect(response.status).toBe(503);
        expect(response.body).toEqual({
            success: false,
            code: 'SERVICE_BUSY',
            message: 'El servicio está temporalmente ocupado. Intenta nuevamente.'
        });
    });
});

describe('métricas internas y coordinación', () => {
    test('el apagado deja de aceptar HTTP antes de detener jobs y cerrar MySQL', async () => {
        const order = [];
        const server = {
            close: callback => { order.push('http'); callback(); },
            closeIdleConnections: () => order.push('idle')
        };
        const exit = jest.fn();
        const shutdown = createGracefulShutdown({
            getServer: () => server,
            stopJobs: async () => order.push('jobs'),
            closeDatabase: async () => order.push('database'),
            exit
        });

        await expect(shutdown('SIGTERM')).resolves.toBe(true);
        await expect(shutdown('SIGTERM')).resolves.toBe(false);
        expect(order).toEqual(['http', 'idle', 'jobs', 'database']);
        expect(exit).toHaveBeenCalledWith(0);
    });

    test('mantiene contadores del pool sin valores negativos', () => {
        const metrics = createPoolMetrics();
        metrics.onConnection();
        metrics.onEnqueue();
        metrics.onAcquire();
        metrics.onRelease();
        metrics.onRelease();
        expect(metrics.snapshot()).toEqual(expect.objectContaining({
            physicalConnectionsCreated: 1,
            totalEnqueued: 1,
            totalAcquisitions: 1
        }));
    });

    test('marca jobs fallidos, exitosos y detenidos por silencio', async () => {
        let now = 1000;
        const registry = createJobStateRegistry({ now: () => now });
        await registry.run('state', 100, async () => 'ok');
        now = 1200;
        expect(registry.snapshot()[0].healthy).toBe(false);
        await expect(registry.run('state', 100, async () => { throw new Error('fail'); })).rejects.toThrow('fail');
        expect(registry.snapshot()[0].failures).toBe(1);
    });

    test('el lock MySQL evita duplicados y siempre libera su conexión', async () => {
        const connection = {
            query: jest.fn()
                .mockResolvedValueOnce([[{ acquired: 1 }]])
                .mockResolvedValueOnce([[{ released: 1 }]]),
            release: jest.fn()
        };
        const operation = jest.fn().mockResolvedValue('done');
        const result = await withMysqlLock({ getConnection: async () => connection }, 'lottery:test', operation);
        expect(result).toEqual({ acquired: true, result: 'done' });
        expect(operation).toHaveBeenCalledTimes(1);
        expect(connection.release).toHaveBeenCalledTimes(1);
    });
});

describe('runner de carga aislado', () => {
    test('se niega a usar una base no aislada', async () => {
        await expect(runLoadTest({ NODE_ENV: 'test', ALLOW_LOAD_TEST: 'true', MYSQL_DB: 'lottery_app', LOAD_TEST_DATABASE: 'lottery_app' }))
            .rejects.toThrow('_load_test');
    });

    test('calcula percentiles y tasa de error con concurrencia acotada', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({ status: 200, arrayBuffer: async () => new ArrayBuffer(0) });
        const result = await runLoadTest({
            NODE_ENV: 'test',
            ALLOW_LOAD_TEST: 'true',
            MYSQL_DB: 'lottery_load_test',
            LOAD_TEST_DATABASE: 'lottery_load_test',
            LOAD_TEST_BASE_URL: 'http://127.0.0.1:2000',
            LOAD_TEST_USER_TOKEN: 'token',
            LOAD_TEST_CONCURRENCY: '2',
            LOAD_TEST_REQUESTS_PER_WORKER: '3'
        }, fetchImpl);
        expect(result.totalRequests).toBe(6);
        expect(result.errorRate).toBe(0);
        expect(result.latencyMs).toEqual(expect.objectContaining({ p50: expect.any(Number), p95: expect.any(Number), p99: expect.any(Number) }));
    });

    test('cuenta 429, 503 y otros estados inesperados sin tratarlos como Ã©xito', async () => {
        const responses = [200, 429, 503, 404];
        let index = 0;
        const fetchImpl = jest.fn(async () => ({ status: responses[index++], arrayBuffer: async () => new ArrayBuffer(0) }));
        const result = await runLoadTest({
            NODE_ENV: 'test', ALLOW_LOAD_TEST: 'true', MYSQL_DB: 'lottery_load_test',
            LOAD_TEST_DATABASE: 'lottery_load_test', LOAD_TEST_BASE_URL: 'http://127.0.0.1:2000',
            LOAD_TEST_USER_TOKEN: 'token', LOAD_TEST_CONCURRENCY: '1', LOAD_TEST_REQUESTS_PER_WORKER: '4'
        }, fetchImpl);

        expect(result).toEqual(expect.objectContaining({
            successfulRequests: 1, expectedRequests: 1, unexpectedRequests: 3,
            rateLimitedRequests: 1, serviceBusyRequests: 1, otherClientErrorRequests: 1,
            errorRate: 0.75
        }));
    });

    test('permite declarar 503 como esperado sin contarlo como solicitud exitosa', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({ status: 503, arrayBuffer: async () => new ArrayBuffer(0) });
        const result = await runLoadTest({
            NODE_ENV: 'test', ALLOW_LOAD_TEST: 'true', MYSQL_DB: 'lottery_load_test',
            LOAD_TEST_DATABASE: 'lottery_load_test', LOAD_TEST_BASE_URL: 'http://127.0.0.1:2000',
            LOAD_TEST_USER_TOKEN: 'token', LOAD_TEST_EXPECTED_STATUSES: '200,503',
            LOAD_TEST_CONCURRENCY: '1', LOAD_TEST_REQUESTS_PER_WORKER: '1'
        }, fetchImpl);

        expect(result).toEqual(expect.objectContaining({
            successfulRequests: 0, expectedRequests: 1, unexpectedRequests: 0,
            serviceBusyRequests: 1, errorRate: 0
        }));
    });

    test('respeta el mix ponderado completo cuando hay tokens de usuario y administrador', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({ status: 200, arrayBuffer: async () => new ArrayBuffer(0) });
        const result = await runLoadTest({
            NODE_ENV: 'test',
            ALLOW_LOAD_TEST: 'true',
            MYSQL_DB: 'lottery_load_test',
            LOAD_TEST_DATABASE: 'lottery_load_test',
            LOAD_TEST_BASE_URL: 'http://127.0.0.1:2000',
            LOAD_TEST_USER_TOKEN: 'user-token',
            LOAD_TEST_ADMIN_TOKEN: 'admin-token',
            LOAD_TEST_DRAW_ID: '41',
            LOAD_TEST_CONCURRENCY: '10',
            LOAD_TEST_REQUESTS_PER_WORKER: '10'
        }, fetchImpl);
        expect(Object.fromEntries(Object.entries(result.byScenario).map(([name, metric]) => [name, metric.totalRequests])))
            .toEqual({
                'draws.open': 30,
                'draws.availability': 20,
                'wallet.balance': 8,
                'wallet.transactions': 6,
                'bets.history': 6,
                'auth.profile': 15,
                'admin.summary': 10,
                'health.ready': 5
            });
    });

    test('asigna una IP virtual estable por worker cuando el soak lo solicita', async () => {
        const fetchImpl = jest.fn().mockResolvedValue({ status: 200, arrayBuffer: async () => new ArrayBuffer(0) });
        await runLoadTest({
            NODE_ENV: 'test', ALLOW_LOAD_TEST: 'true', MYSQL_DB: 'lottery_load_test',
            LOAD_TEST_DATABASE: 'lottery_load_test', LOAD_TEST_BASE_URL: 'http://127.0.0.1:2000',
            LOAD_TEST_USER_TOKENS: 'one,two', LOAD_TEST_VIRTUAL_IPS: 'true',
            LOAD_TEST_CONCURRENCY: '2', LOAD_TEST_REQUESTS_PER_WORKER: '1'
        }, fetchImpl);

        expect(fetchImpl.mock.calls.map(call => call[1].headers['X-Forwarded-For'])).toEqual([
            '198.18.0.1', '198.18.0.2'
        ]);
    });
});
