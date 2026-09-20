import { pathToFileURL } from 'node:url';

const REQUIRED_DATABASE_SUFFIX = /(?:^|_)load_test$/i;

function requireSafeEnvironment(environment) {
    if (environment.NODE_ENV !== 'test' || environment.ALLOW_LOAD_TEST !== 'true') {
        throw new Error('La carga requiere NODE_ENV=test y ALLOW_LOAD_TEST=true.');
    }
    if (!environment.LOAD_TEST_DATABASE || environment.LOAD_TEST_DATABASE !== environment.MYSQL_DB) {
        throw new Error('LOAD_TEST_DATABASE debe coincidir exactamente con MYSQL_DB.');
    }
    const currentDatabaseExplicitlyAllowed = environment.ALLOW_CURRENT_DB_LOAD_TEST === 'true';
    if (!REQUIRED_DATABASE_SUFFIX.test(environment.LOAD_TEST_DATABASE) && !currentDatabaseExplicitlyAllowed) {
        throw new Error('La base aislada debe terminar en _load_test.');
    }

    const baseUrl = new URL(environment.LOAD_TEST_BASE_URL || 'http://127.0.0.1:2000');
    if (!['127.0.0.1', 'localhost', '::1'].includes(baseUrl.hostname)) {
        throw new Error('El runner solo admite un backend local aislado.');
    }
    return baseUrl.origin;
}

function percentile(sorted, value) {
    if (sorted.length === 0) return 0;
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)];
}

function buildScenarios(environment) {
    const drawId = environment.LOAD_TEST_DRAW_ID;
    const hasAdmin = Boolean(environment.LOAD_TEST_ADMIN_TOKEN);
    const scenarios = [
        { name: 'draws.open', path: '/draw/open', weight: 30, authenticated: 'user' },
        ...(drawId ? [{
            name: 'draws.availability', path: `/draw/${drawId}/availability`, weight: 20, authenticated: 'user'
        }] : [{ name: 'draws.open.fallback', path: '/draw/open', weight: 20, authenticated: 'user' }]),
        { name: 'wallet.balance', path: '/wallet/balance', weight: 8, authenticated: 'user' },
        { name: 'wallet.transactions', path: '/wallet/transactions?page=1&limit=10', weight: 6, authenticated: 'user' },
        { name: 'bets.history', path: '/bet/history?page=1&limit=10', weight: 6, authenticated: 'user' },
        { name: 'auth.profile', path: '/auth/me', weight: 15, authenticated: 'user' },
        ...(hasAdmin
            ? [{ name: 'admin.summary', path: '/admin/summary', weight: 10, authenticated: 'admin' }]
            : [{ name: 'wallet.rules', path: '/wallet/operation-rules', weight: 10, authenticated: 'user' }]),
        { name: 'health.ready', path: '/health/ready', weight: 5 }
    ];
    return scenarios.flatMap(item => Array(item.weight).fill(item));
}

function summarizeLatencies(values) {
    const sorted = [...values].sort((left, right) => left - right);
    return {
        p50: Number(percentile(sorted, 0.50).toFixed(2)),
        p95: Number(percentile(sorted, 0.95).toFixed(2)),
        p99: Number(percentile(sorted, 0.99).toFixed(2)),
        max: Number(percentile(sorted, 1).toFixed(2))
    };
}

function classifyStatuses(statuses, expectedStatuses) {
    const classification = {
        successfulRequests: 0,
        expectedRequests: 0,
        unexpectedRequests: 0,
        rateLimitedRequests: 0,
        serviceBusyRequests: 0,
        otherClientErrorRequests: 0,
        serverErrorRequests: 0,
        networkErrorRequests: 0
    };
    for (const [status, count] of statuses.entries()) {
        const numericStatus = Number(status);
        if (numericStatus >= 200 && numericStatus < 300) classification.successfulRequests += count;
        if (expectedStatuses.has(String(status))) classification.expectedRequests += count;
        else classification.unexpectedRequests += count;

        if (status === 'network_error') classification.networkErrorRequests += count;
        else if (numericStatus === 429) classification.rateLimitedRequests += count;
        else if (numericStatus === 503) classification.serviceBusyRequests += count;
        else if (numericStatus >= 400 && numericStatus < 500) classification.otherClientErrorRequests += count;
        else if (numericStatus >= 500) classification.serverErrorRequests += count;
    }
    return classification;
}

export async function runLoadTest(environment = process.env, fetchImpl = fetch) {
    const baseUrl = requireSafeEnvironment(environment);
    const concurrency = Math.min(200, Math.max(1, Number(environment.LOAD_TEST_CONCURRENCY || 20)));
    const requestsPerWorker = Math.min(1000, Math.max(1, Number(environment.LOAD_TEST_REQUESTS_PER_WORKER || 25)));
    const pacingMs = Number(environment.LOAD_TEST_PACING_MS || 0);
    if (!Number.isFinite(pacingMs) || pacingMs < 0 || pacingMs > 60000) {
        throw new Error('LOAD_TEST_PACING_MS debe estar entre 0 y 60000 milisegundos.');
    }
    const tokens = (environment.LOAD_TEST_USER_TOKENS || environment.LOAD_TEST_USER_TOKEN || '')
        .split(',')
        .map(token => token.trim())
        .filter(Boolean);
    if (tokens.length === 0) throw new Error('LOAD_TEST_USER_TOKEN(S) es obligatorio para medir una ruta autenticada.');

    const latencies = [];
    const statuses = new Map();
    const scenarioMetrics = new Map();
    const scenarios = buildScenarios(environment);
    const adminToken = environment.LOAD_TEST_ADMIN_TOKEN;
    const expectedStatuses = new Set((environment.LOAD_TEST_EXPECTED_STATUSES || '200')
        .split(',').map(status => status.trim()).filter(Boolean));
    let scenarioCursor = 0;

    const worker = async workerId => {
        for (let index = 0; index < requestsPerWorker; index += 1) {
            const currentScenario = scenarioCursor;
            scenarioCursor += 1;
            const scenario = scenarios[currentScenario % scenarios.length];
            const started = performance.now();
            try {
                const token = scenario.authenticated === 'admin'
                    ? adminToken
                    : tokens[workerId % tokens.length];
                const headers = scenario.authenticated ? { Authorization: `Bearer ${token}` } : {};
                if (environment.LOAD_TEST_VIRTUAL_IPS === 'true') {
                    headers['X-Forwarded-For'] = `198.18.${Math.floor(workerId / 250)}.${(workerId % 250) + 1}`;
                }
                const response = await fetchImpl(`${baseUrl}${scenario.path}`, { headers });
                await response.arrayBuffer();
                statuses.set(response.status, (statuses.get(response.status) || 0) + 1);
                const metric = scenarioMetrics.get(scenario.name) || { latencies: [], statuses: new Map() };
                metric.statuses.set(response.status, (metric.statuses.get(response.status) || 0) + 1);
                metric.latencies.push(performance.now() - started);
                scenarioMetrics.set(scenario.name, metric);
            } catch {
                statuses.set('network_error', (statuses.get('network_error') || 0) + 1);
                const metric = scenarioMetrics.get(scenario.name) || { latencies: [], statuses: new Map() };
                metric.statuses.set('network_error', (metric.statuses.get('network_error') || 0) + 1);
                metric.latencies.push(performance.now() - started);
                scenarioMetrics.set(scenario.name, metric);
            } finally {
                latencies.push(performance.now() - started);
            }
            if (pacingMs > 0) await new Promise(resolve => setTimeout(resolve, pacingMs));
        }
    };

    const started = performance.now();
    await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(index)));
    const totalDurationMs = performance.now() - started;
    const totalRequests = latencies.length;
    const classification = classifyStatuses(statuses, expectedStatuses);

    return {
        database: environment.LOAD_TEST_DATABASE,
        concurrency,
        pacingMs,
        totalRequests,
        requestsPerSecond: Number((totalRequests / (totalDurationMs / 1000)).toFixed(2)),
        ...classification,
        errorRate: Number((classification.unexpectedRequests / totalRequests).toFixed(4)),
        latencyMs: summarizeLatencies(latencies),
        statuses: Object.fromEntries(statuses),
        byScenario: Object.fromEntries([...scenarioMetrics.entries()].map(([name, metric]) => [name, {
            totalRequests: metric.latencies.length,
            latencyMs: summarizeLatencies(metric.latencies),
            statuses: Object.fromEntries(metric.statuses),
            ...classifyStatuses(metric.statuses, expectedStatuses)
        }]))
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runLoadTest()
        .then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(error => {
            console.error(`[LOAD TEST REFUSED] ${error.message}`);
            process.exitCode = 1;
        });
}
