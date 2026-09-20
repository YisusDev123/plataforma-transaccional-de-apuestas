import express from 'express';
import { observabilityAuth } from './metrics.js';

export function createDatabaseReadinessCheck(pool, { ttlMs = 1500, now = Date.now } = {}) {
    let cachedResult = null;
    let inFlight = null;

    return async function checkDatabase() {
        const currentTime = now();
        if (cachedResult && currentTime < cachedResult.expiresAt) return cachedResult.available;
        if (inFlight) return inFlight;

        inFlight = pool.query({ sql: 'SELECT 1', timeout: 1000 })
            .then(() => true)
            .catch(() => false)
            .then(available => {
                cachedResult = { available, expiresAt: now() + ttlMs };
                return available;
            })
            .finally(() => {
                inFlight = null;
            });

        return inFlight;
    };
}

export function createObservabilityRouter({
    pool,
    settingsService,
    jobsOrquestador,
    metricsRegistry,
    poolMetrics,
    runtimeConfig
}) {
    const router = express.Router();
    const startedAt = new Date().toISOString();
    const checkDatabase = createDatabaseReadinessCheck(pool);

    router.get('/health/live', (req, res) => res.status(200).json({
        success: true,
        status: 'alive',
        correlationId: req.correlationId
    }));

    router.get('/health/ready', async (req, res) => {
        const components = { database: 'ready', settings: 'ready', jobs: 'not_applicable' };
        res.set('Cache-Control', 'no-store');
        if (!await checkDatabase()) components.database = 'unavailable';

        const settings = settingsService.getAll();
        if (!settings || Object.keys(settings).length === 0) components.settings = 'unavailable';

        if (runtimeConfig.app.processRole !== 'api') {
            components.jobs = jobsOrquestador.estaIniciado() ? 'ready' : 'unavailable';
        }

        const ready = !Object.values(components).includes('unavailable');
        return res.status(ready ? 200 : 503).json({
            success: ready,
            status: ready ? 'ready' : 'unavailable',
            components,
            correlationId: req.correlationId
        });
    });

    router.get('/internal/metrics', observabilityAuth(runtimeConfig.security.observabilityToken), async (req, res, next) => {
        try {
            const alerts = await jobsOrquestador.obtenerAlertas();
            return res.status(200).json({
                success: true,
                data: {
                    http: metricsRegistry.snapshot(),
                    mysqlPool: {
                        limits: {
                            connections: runtimeConfig.mysql.connectionLimit,
                            queue: runtimeConfig.mysql.queueLimit,
                            acquireTimeoutMs: runtimeConfig.mysql.acquireTimeoutMs,
                            queryTimeoutMs: runtimeConfig.mysql.queryTimeoutMs,
                            lockWaitTimeoutSeconds: runtimeConfig.mysql.lockWaitTimeoutSeconds
                        },
                        ...poolMetrics.snapshot()
                    },
                    jobs: jobsOrquestador.obtenerEstado(),
                    alerts
                },
                correlationId: req.correlationId
            });
        } catch (error) {
            next(error);
        }
    });

    router.get('/internal/version', observabilityAuth(runtimeConfig.security.observabilityToken), (req, res) => (
        res.status(200).json({
            success: true,
            data: {
                release: runtimeConfig.app.release,
                environment: runtimeConfig.app.environment,
                role: runtimeConfig.app.processRole,
                startedAt
            },
            correlationId: req.correlationId
        })
    ));

    return router;
}
