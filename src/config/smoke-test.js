function validateBaseUrl(rawUrl, environment) {
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error('SMOKE_BASE_URL_INVALID');
    }
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        throw new Error('SMOKE_BASE_URL_INVALID');
    }
    if (environment === 'production' && url.protocol !== 'https:') {
        throw new Error('SMOKE_REQUIRES_HTTPS');
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('SMOKE_BASE_URL_INVALID');
    return url.origin;
}

async function call(fetchImpl, url, options = {}) {
    const response = await fetchImpl(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(5000)
    });
    let body;
    try {
        body = await response.json();
    } catch {
        body = null;
    }
    return { response, body };
}

export async function runSmokeTest({
    baseUrl,
    environment,
    observabilityToken,
    userToken,
    allowedOrigin,
    fetchImpl = fetch
}) {
    const origin = validateBaseUrl(baseUrl, environment);
    const checks = [];
    const record = (name, passed, detail) => checks.push({ name, passed, detail });

    const live = await call(fetchImpl, `${origin}/health/live`);
    record('liveness', live.response.status === 200 && live.body?.status === 'alive', `HTTP ${live.response.status}`);

    const ready = await call(fetchImpl, `${origin}/health/ready`);
    record('readiness', ready.response.status === 200 && ready.body?.status === 'ready', `HTTP ${ready.response.status}`);

    const missing = await call(fetchImpl, `${origin}/smoke-route-that-does-not-exist`);
    record('json_404', missing.response.status === 404 && missing.body?.code === 'ROUTE_NOT_FOUND', `HTTP ${missing.response.status}`);

    const metricsDenied = await call(fetchImpl, `${origin}/internal/metrics`);
    record('metrics_protected', metricsDenied.response.status === 401, `HTTP ${metricsDenied.response.status}`);

    const internalHeaders = { 'X-Observability-Token': observabilityToken };
    const version = await call(fetchImpl, `${origin}/internal/version`, { headers: internalHeaders });
    record('release_visible', version.response.status === 200 && Boolean(version.body?.data?.release), `HTTP ${version.response.status}`);

    const metrics = await call(fetchImpl, `${origin}/internal/metrics`, { headers: internalHeaders });
    record('metrics_available', metrics.response.status === 200 && Boolean(metrics.body?.data?.mysqlPool), `HTTP ${metrics.response.status}`);

    if (allowedOrigin) {
        const cors = await call(fetchImpl, `${origin}/health/live`, { headers: { Origin: allowedOrigin } });
        record('cors_allowed', cors.response.status === 200
            && cors.response.headers.get('access-control-allow-origin') === allowedOrigin, `HTTP ${cors.response.status}`);
    }

    if (userToken) {
        const draws = await call(fetchImpl, `${origin}/draw/open`, {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        record('authenticated_read', draws.response.status === 200, `HTTP ${draws.response.status}`);
    }

    return { success: checks.every(item => item.passed), checks };
}
