import crypto from 'crypto'

const TEST_DEFAULTS = Object.freeze({
    MYSQL_HOST: '127.0.0.1',
    MYSQL_USER: 'test-user',
    MYSQL_PASSWORD: 'test-password',
    MYSQL_DB: 'test-database',
    JWT_SECRET: 'test-only-jwt-secret-with-at-least-thirty-two-bytes',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000',
    OBSERVABILITY_TOKEN: 'test-only-observability-token-with-32-bytes',
    PROCESS_ROLE: 'all',
    MYSQL_CONNECTION_LIMIT: '20',
    MYSQL_QUEUE_LIMIT: '50',
    MYSQL_ACQUIRE_TIMEOUT_MS: '1000',
    MYSQL_QUERY_TIMEOUT_MS: '8000',
    MYSQL_LOCK_WAIT_TIMEOUT_SECONDS: '5',
    APP_RELEASE: 'test',
    REQUIRE_HTTPS: 'false',
    EMAIL_CODE_SECRET: 'test-only-email-code-secret-with-32-bytes'
});

const INSECURE_SECRET_VALUES = new Set([
    'secret',
    'changeme',
    'change-me',
    'jwt_secret',
    'your-secret-here',
    'replace-with-a-secure-random-secret'
]);

export class ConfigurationError extends Error {
    constructor(variable, reason) {
        super(`Configuración inválida en ${variable}: ${reason}`);
        this.name = 'ConfigurationError';
        this.code = 'INVALID_CONFIGURATION';
    }
}

function environmentValue(environment, key, nodeEnv) {
    const value = environment[key];
    if ((value === undefined || value === '') && nodeEnv === 'test') {
        return TEST_DEFAULTS[key];
    }
    return value;
}

function requiredString(environment, key, nodeEnv) {
    const value = environmentValue(environment, key, nodeEnv);
    if (typeof value !== 'string' || value.trim() === '') {
        throw new ConfigurationError(key, 'es obligatoria y no puede estar vacía');
    }
    return value.trim();
}

function parsePort(environment, nodeEnv) {
    const rawPort = environment.PORT ?? (nodeEnv === 'production' ? undefined : '2000');
    if (!/^\d+$/.test(String(rawPort ?? ''))) {
        throw new ConfigurationError('PORT', 'debe ser un entero entre 1 y 65535');
    }

    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ConfigurationError('PORT', 'debe estar entre 1 y 65535');
    }
    return port;
}

function parseJwtSecret(environment, nodeEnv) {
    const secret = requiredString(environment, 'JWT_SECRET', nodeEnv);
    if (INSECURE_SECRET_VALUES.has(secret.toLowerCase())) {
        throw new ConfigurationError('JWT_SECRET', 'usa un valor inseguro o de ejemplo');
    }
    if (nodeEnv === 'production' && Buffer.byteLength(secret, 'utf8') < 32) {
        throw new ConfigurationError('JWT_SECRET', 'debe contener al menos 32 bytes en producción');
    }
    return secret;
}

function parseAllowedOrigins(environment, nodeEnv) {
    const rawOrigins = environmentValue(environment, 'CORS_ALLOWED_ORIGINS', nodeEnv)
        ?? (nodeEnv === 'development' ? TEST_DEFAULTS.CORS_ALLOWED_ORIGINS : undefined);

    if (typeof rawOrigins !== 'string' || rawOrigins.trim() === '') {
        throw new ConfigurationError('CORS_ALLOWED_ORIGINS', 'debe contener al menos un origen explícito');
    }

    const entries = rawOrigins.split(',');
    if (entries.some(entry => entry.trim() === '')) {
        throw new ConfigurationError('CORS_ALLOWED_ORIGINS', 'contiene una entrada vacía');
    }

    const origins = entries.map(entry => {
        const rawOrigin = entry.trim();
        if (rawOrigin === '*') {
            throw new ConfigurationError('CORS_ALLOWED_ORIGINS', 'no permite el comodín *');
        }

        let parsed;
        try {
            parsed = new URL(rawOrigin);
        } catch {
            throw new ConfigurationError('CORS_ALLOWED_ORIGINS', 'contiene un origen no válido');
        }

        if (!['http:', 'https:'].includes(parsed.protocol)
            || parsed.username
            || parsed.password
            || (parsed.pathname !== '/' && parsed.pathname !== '')
            || parsed.search
            || parsed.hash) {
            throw new ConfigurationError('CORS_ALLOWED_ORIGINS', 'solo admite orígenes HTTP(S) sin credenciales, ruta, query o fragmento');
        }

        return parsed.origin;
    });

    return [...new Set(origins)];
}

function parseTrustProxy(environment, nodeEnv) {
    const rawValue = environment.TRUST_PROXY ?? (nodeEnv === 'production' ? undefined : 'false');
    if (rawValue === undefined) {
        throw new ConfigurationError('TRUST_PROXY', 'debe configurarse explícitamente en producción');
    }

    const normalized = String(rawValue).trim().toLowerCase();
    if (normalized === 'false') return false;
    if (normalized === 'loopback') return 'loopback';
    if (normalized === '1') return 1;

    throw new ConfigurationError('TRUST_PROXY', 'solo admite false, loopback o 1');
}

function parseInteger(environment, key, nodeEnv, { defaultValue, min, max }) {
    const rawValue = environmentValue(environment, key, nodeEnv) ?? defaultValue;
    if (!/^\d+$/.test(String(rawValue ?? ''))) {
        throw new ConfigurationError(key, `debe ser un entero entre ${min} y ${max}`);
    }

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new ConfigurationError(key, `debe estar entre ${min} y ${max}`);
    }
    return value;
}

function parseProcessRole(environment, nodeEnv) {
    const role = environment.PROCESS_ROLE ?? (nodeEnv === 'production' ? undefined : 'all');
    if (!['all', 'api', 'worker'].includes(role)) {
        throw new ConfigurationError('PROCESS_ROLE', 'solo admite all, api o worker');
    }
    return role;
}

function parseObservabilityToken(environment, nodeEnv) {
    const token = environmentValue(environment, 'OBSERVABILITY_TOKEN', nodeEnv)
        ?? (nodeEnv === 'development' ? TEST_DEFAULTS.OBSERVABILITY_TOKEN : undefined);
    if (typeof token !== 'string'
        || Buffer.byteLength(token.trim(), 'utf8') < 32
        || token.trim().toLowerCase().startsWith('replace-with-')) {
        throw new ConfigurationError('OBSERVABILITY_TOKEN', 'debe contener al menos 32 bytes');
    }
    return token.trim();
}

function parseBoolean(environment, key, nodeEnv, defaultValue) {
    const rawValue = environmentValue(environment, key, nodeEnv) ?? defaultValue;
    const normalized = String(rawValue ?? '').trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    throw new ConfigurationError(key, 'solo admite true o false');
}

function parseRelease(environment, nodeEnv) {
    const release = environmentValue(environment, 'APP_RELEASE', nodeEnv)
        ?? (nodeEnv === 'development' ? 'local' : undefined);
    if (typeof release !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(release.trim())) {
        throw new ConfigurationError('APP_RELEASE', 'debe identificar el release con 1 a 64 caracteres seguros');
    }
    return release.trim();
}

function parseHttpConfig(environment, nodeEnv) {
    const http = {
        requestTimeoutMs: parseInteger(environment, 'HTTP_REQUEST_TIMEOUT_MS', nodeEnv, {
            defaultValue: '15000', min: 1000, max: 120000
        }),
        headersTimeoutMs: parseInteger(environment, 'HTTP_HEADERS_TIMEOUT_MS', nodeEnv, {
            defaultValue: '10000', min: 1000, max: 60000
        }),
        keepAliveTimeoutMs: parseInteger(environment, 'HTTP_KEEP_ALIVE_TIMEOUT_MS', nodeEnv, {
            defaultValue: '5000', min: 1000, max: 60000
        }),
        shutdownTimeoutMs: parseInteger(environment, 'SHUTDOWN_TIMEOUT_MS', nodeEnv, {
            defaultValue: '10000', min: 1000, max: 60000
        })
    };
    if (http.headersTimeoutMs > http.requestTimeoutMs) {
        throw new ConfigurationError('HTTP_HEADERS_TIMEOUT_MS', 'no puede superar HTTP_REQUEST_TIMEOUT_MS');
    }
    return Object.freeze(http);
}

function parseEmailConfig(environment, nodeEnv, jwtSecret) {
    const provider = nodeEnv === 'test'
        ? 'memory'
        : String(environment.EMAIL_PROVIDER ?? (nodeEnv === 'development' ? 'disabled' : '')).trim().toLowerCase();
    if (!['disabled', 'memory', 'twilio'].includes(provider)
        || (nodeEnv === 'production' && provider !== 'twilio')
        || (nodeEnv !== 'test' && provider === 'memory')) {
        throw new ConfigurationError('EMAIL_PROVIDER', nodeEnv === 'production'
            ? 'debe ser twilio en producción'
            : 'solo admite disabled o twilio');
    }

    const configuredSecret = nodeEnv === 'test'
        ? TEST_DEFAULTS.EMAIL_CODE_SECRET
        : environment.EMAIL_CODE_SECRET;
    const codeSecret = configuredSecret || (nodeEnv === 'production'
        ? undefined
        : crypto.createHash('sha256').update(`email-code:${jwtSecret}`).digest('hex'));
    if (typeof codeSecret !== 'string'
        || Buffer.byteLength(codeSecret.trim(), 'utf8') < 32
        || codeSecret.trim().toLowerCase().startsWith('replace-with-')) {
        throw new ConfigurationError('EMAIL_CODE_SECRET', 'debe contener al menos 32 bytes seguros');
    }

    const apiKeySid = provider === 'twilio'
        ? requiredString(environment, 'TWILIO_API_KEY_SID', nodeEnv)
        : null;
    if (apiKeySid && !/^SK[0-9a-fA-F]{32}$/.test(apiKeySid)) {
        throw new ConfigurationError('TWILIO_API_KEY_SID', 'debe ser un Key SID de Twilio con prefijo SK');
    }

    const apiKeySecret = provider === 'twilio'
        ? requiredString(environment, 'TWILIO_API_KEY_SECRET', nodeEnv)
        : null;
    if (apiKeySecret && (Buffer.byteLength(apiKeySecret, 'utf8') < 32
        || apiKeySecret.toLowerCase().startsWith('replace-with-'))) {
        throw new ConfigurationError('TWILIO_API_KEY_SECRET', 'debe contener al menos 32 bytes seguros');
    }

    const fromValue = provider === 'twilio'
        ? requiredString(environment, 'EMAIL_FROM', nodeEnv)
        : null;
    const fromMatch = fromValue?.match(/^([^<>]+)<([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>$/);
    if (provider === 'twilio' && !fromMatch) {
        throw new ConfigurationError('EMAIL_FROM', 'debe usar el formato Nombre <correo@dominio>');
    }

    return Object.freeze({
        provider,
        apiKeySid,
        apiKeySecret,
        from: fromMatch ? Object.freeze({
            name: fromMatch[1].trim(),
            address: fromMatch[2]
        }) : null,
        codeSecret: codeSecret.trim(),
        requestTimeoutMs: parseInteger(environment, 'EMAIL_REQUEST_TIMEOUT_MS', nodeEnv, {
            defaultValue: '5000', min: 1000, max: 15000
        })
    });
}

export function loadConfig(environment = process.env) {
    const nodeEnv = environment.NODE_ENV || 'development';
    if (!['development', 'test', 'production'].includes(nodeEnv)) {
        throw new ConfigurationError('NODE_ENV', 'solo admite development, test o production');
    }

    const processRole = parseProcessRole(environment, nodeEnv);
    const minimumConnections = processRole === 'api' ? 2 : 3;
    const jwtSecret = parseJwtSecret(environment, nodeEnv);

    return Object.freeze({
        app: Object.freeze({
            environment: nodeEnv,
            port: parsePort(environment, nodeEnv),
            trustProxy: parseTrustProxy(environment, nodeEnv),
            processRole,
            release: parseRelease(environment, nodeEnv),
            requireHttps: parseBoolean(environment, 'REQUIRE_HTTPS', nodeEnv, nodeEnv === 'production' ? undefined : 'false'),
            http: parseHttpConfig(environment, nodeEnv)
        }),
        mysql: Object.freeze({
            host: requiredString(environment, 'MYSQL_HOST', nodeEnv),
            user: requiredString(environment, 'MYSQL_USER', nodeEnv),
            password: requiredString(environment, 'MYSQL_PASSWORD', nodeEnv),
            database: requiredString(environment, 'MYSQL_DB', nodeEnv),
            connectionLimit: parseInteger(environment, 'MYSQL_CONNECTION_LIMIT', nodeEnv, {
                defaultValue: '20', min: minimumConnections, max: 100
            }),
            queueLimit: parseInteger(environment, 'MYSQL_QUEUE_LIMIT', nodeEnv, {
                defaultValue: '50', min: 1, max: 1000
            }),
            acquireTimeoutMs: parseInteger(environment, 'MYSQL_ACQUIRE_TIMEOUT_MS', nodeEnv, {
                defaultValue: '1000', min: 100, max: 10000
            }),
            queryTimeoutMs: parseInteger(environment, 'MYSQL_QUERY_TIMEOUT_MS', nodeEnv, {
                defaultValue: '8000', min: 1000, max: 60000
            }),
            lockWaitTimeoutSeconds: parseInteger(environment, 'MYSQL_LOCK_WAIT_TIMEOUT_SECONDS', nodeEnv, {
                defaultValue: '5', min: 1, max: 50
            })
        }),
        security: Object.freeze({
            jwtSecret,
            corsAllowedOrigins: Object.freeze(parseAllowedOrigins(environment, nodeEnv)),
            observabilityToken: parseObservabilityToken(environment, nodeEnv)
        }),
        email: parseEmailConfig(environment, nodeEnv, jwtSecret)
    });
}
