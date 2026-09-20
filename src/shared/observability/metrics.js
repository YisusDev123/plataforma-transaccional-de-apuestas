import { timingSafeEqual } from 'node:crypto';

const LATENCY_BUCKETS_MS = Object.freeze([25, 50, 100, 250, 500, 1000, 2500, 5000]);

function routePattern(req) {
    const rawPath = req.route?.path
        ? `${req.baseUrl || ''}${req.route.path}`
        : '/unmatched';
    return rawPath
        .replace(/\b\d+\b/g, ':id')
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
        .slice(0, 160);
}

export function createMetricsRegistry({ now = () => process.hrtime.bigint() } = {}) {
    const startedAt = new Date().toISOString();
    const routes = new Map();

    function observe(req, statusCode, durationMs) {
        const key = `${req.method} ${routePattern(req)}`;
        const current = routes.get(key) || {
            method: req.method,
            route: routePattern(req),
            requests: 0,
            errors: 0,
            durationMsTotal: 0,
            maxDurationMs: 0,
            latencyBuckets: Object.fromEntries(LATENCY_BUCKETS_MS.map(bucket => [bucket, 0]))
        };
        current.requests += 1;
        current.errors += statusCode >= 500 ? 1 : 0;
        current.durationMsTotal += durationMs;
        current.maxDurationMs = Math.max(current.maxDurationMs, durationMs);
        for (const bucket of LATENCY_BUCKETS_MS) {
            if (durationMs <= bucket) current.latencyBuckets[bucket] += 1;
        }
        routes.set(key, current);
    }

    function middleware(req, res, next) {
        const start = now();
        res.once('finish', () => {
            const elapsed = Number(now() - start) / 1e6;
            observe(req, res.statusCode, Number(elapsed.toFixed(3)));
        });
        next();
    }

    function snapshot() {
        return {
            startedAt,
            routes: [...routes.values()].map(item => ({
                ...item,
                averageDurationMs: item.requests
                    ? Number((item.durationMsTotal / item.requests).toFixed(3))
                    : 0,
                durationMsTotal: Number(item.durationMsTotal.toFixed(3)),
                maxDurationMs: Number(item.maxDurationMs.toFixed(3))
            }))
        };
    }

    return { middleware, observe, snapshot };
}

export function observabilityAuth(expectedToken) {
    const expected = Buffer.from(expectedToken);
    return (req, res, next) => {
        const supplied = req.get('x-observability-token');
        const received = Buffer.from(supplied || '');
        if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
            return res.status(401).json({
                success: false,
                code: 'OBSERVABILITY_AUTH_REQUIRED',
                message: 'Se requiere autenticación de observabilidad.'
            });
        }
        next();
    };
}
