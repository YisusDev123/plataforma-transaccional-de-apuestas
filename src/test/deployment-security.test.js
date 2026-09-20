import { afterEach, describe, expect, jest, test } from '@jest/globals';
import cors from 'cors';
import express from 'express';
import request from 'supertest';
import { ConfigurationError, loadConfig } from '../config/environment.js';
import { createCorsOptions } from '../config/cors.js';
import { prepareApplication } from '../config/bootstrap.js';
import { normalizeDevice } from '../shared/utils/request-metadata.js';
import { submitKycSchema } from '../schemas/kyc-schema.js';
import { globalErrorHandler } from '../shared/error/globalErrors.js';
import { logger } from '../shared/error/winston.js';

const validProductionEnvironment = Object.freeze({
    NODE_ENV: 'production',
    PORT: '8080',
    APP_RELEASE: '2026.08.31-1',
    MYSQL_HOST: 'db.internal',
    MYSQL_USER: 'lottery_user',
    MYSQL_PASSWORD: 'local-test-password',
    MYSQL_DB: 'lottery',
    JWT_SECRET: 'a-secure-production-secret-with-more-than-32-bytes',
    CORS_ALLOWED_ORIGINS: 'https://app.lottery.example,https://admin.lottery.example',
    TRUST_PROXY: '1',
    REQUIRE_HTTPS: 'true',
    PROCESS_ROLE: 'api',
    MYSQL_CONNECTION_LIMIT: '20',
    MYSQL_QUEUE_LIMIT: '50',
    MYSQL_ACQUIRE_TIMEOUT_MS: '1000',
    HTTP_REQUEST_TIMEOUT_MS: '15000',
    HTTP_HEADERS_TIMEOUT_MS: '10000',
    HTTP_KEEP_ALIVE_TIMEOUT_MS: '5000',
    SHUTDOWN_TIMEOUT_MS: '10000',
    OBSERVABILITY_TOKEN: 'a-separate-observability-token-with-more-than-32-bytes',
    EMAIL_PROVIDER: 'twilio',
    TWILIO_API_KEY_SID: 'SK00000000000000000000000000000000',
    TWILIO_API_KEY_SECRET: 'twilio-production-test-secret-with-32-bytes',
    EMAIL_FROM: 'Loto Demo <seguridad@mail.lottery.example>',
    EMAIL_CODE_SECRET: 'an-independent-email-code-secret-with-32-bytes',
    EMAIL_REQUEST_TIMEOUT_MS: '5000'
});

describe('configuración segura de arranque', () => {
    test('convierte y congela una configuración de producción válida', () => {
        const config = loadConfig(validProductionEnvironment);

        expect(config.app).toEqual({
            environment: 'production', port: 8080, trustProxy: 1, processRole: 'api',
            release: '2026.08.31-1', requireHttps: true,
            http: {
                requestTimeoutMs: 15000, headersTimeoutMs: 10000,
                keepAliveTimeoutMs: 5000, shutdownTimeoutMs: 10000
            }
        });
        expect(config.mysql.connectionLimit).toBe(20);
        expect(config.mysql.queueLimit).toBe(50);
        expect(config.mysql.acquireTimeoutMs).toBe(1000);
        expect(config.mysql.queryTimeoutMs).toBe(8000);
        expect(config.mysql.lockWaitTimeoutSeconds).toBe(5);
        expect(config.security.corsAllowedOrigins).toEqual([
            'https://app.lottery.example',
            'https://admin.lottery.example'
        ]);
        expect(config.email.provider).toBe('twilio');
        expect(config.email.from).toEqual({
            name: 'Loto Demo',
            address: 'seguridad@mail.lottery.example'
        });
        expect(config.email.requestTimeoutMs).toBe(5000);
        expect(Object.isFrozen(config)).toBe(true);
        expect(Object.isFrozen(config.security.corsAllowedOrigins)).toBe(true);
    });

    test.each([
        ['NODE_ENV', { NODE_ENV: 'staging' }],
        ['PORT ausente', { PORT: undefined }],
        ['PORT fuera de rango', { PORT: '70000' }],
        ['MYSQL_HOST', { MYSQL_HOST: '' }],
        ['JWT_SECRET débil', { JWT_SECRET: 'secret' }],
        ['JWT_SECRET corto', { JWT_SECRET: 'demasiado-corto' }],
        ['CORS wildcard', { CORS_ALLOWED_ORIGINS: '*' }],
        ['CORS con path', { CORS_ALLOWED_ORIGINS: 'https://app.lottery.example/ruta' }],
        ['TRUST_PROXY indiscriminado', { TRUST_PROXY: 'true' }],
        ['PROCESS_ROLE inválido', { PROCESS_ROLE: 'web' }],
        ['pool sin conexiones', { MYSQL_CONNECTION_LIMIT: '0' }],
        ['cola ilimitada', { MYSQL_QUEUE_LIMIT: '0' }],
        ['timeout de adquisición inválido', { MYSQL_ACQUIRE_TIMEOUT_MS: '0' }],
        ['timeout de consulta inválido', { MYSQL_QUERY_TIMEOUT_MS: '0' }],
        ['timeout de lock inválido', { MYSQL_LOCK_WAIT_TIMEOUT_SECONDS: '0' }],
        ['APP_RELEASE ausente', { APP_RELEASE: undefined }],
        ['APP_RELEASE inválido', { APP_RELEASE: 'release con espacios' }],
        ['REQUIRE_HTTPS ausente', { REQUIRE_HTTPS: undefined }],
        ['REQUIRE_HTTPS inválido', { REQUIRE_HTTPS: 'yes' }],
        ['headers timeout mayor al request timeout', { HTTP_HEADERS_TIMEOUT_MS: '20000' }],
        ['token de observabilidad corto', { OBSERVABILITY_TOKEN: 'short' }],
        ['token de observabilidad de ejemplo', { OBSERVABILITY_TOKEN: 'replace-with-a-separate-random-observability-token' }],
        ['proveedor de correo desactivado', { EMAIL_PROVIDER: 'disabled' }],
        ['Key SID de correo ausente', { TWILIO_API_KEY_SID: undefined }],
        ['Account SID usado como Key SID', { TWILIO_API_KEY_SID: 'AC00000000000000000000000000000000' }],
        ['API key secret de correo ausente', { TWILIO_API_KEY_SECRET: undefined }],
        ['API key secret de correo inseguro', { TWILIO_API_KEY_SECRET: 'replace-with-a-secret-value-long-enough' }],
        ['remitente de correo inválido', { EMAIL_FROM: 'correo-invalido' }],
        ['secreto de códigos corto', { EMAIL_CODE_SECRET: 'short' }]
    ])('rechaza %s', (_name, override) => {
        expect(() => loadConfig({ ...validProductionEnvironment, ...override }))
            .toThrow(ConfigurationError);
    });

    test('los errores de configuración no incluyen valores secretos', () => {
        const exposedSecret = 'your-secret-here';
        let captured;

        try {
            loadConfig({ ...validProductionEnvironment, JWT_SECRET: exposedSecret });
        } catch (error) {
            captured = error;
        }

        expect(captured).toBeInstanceOf(ConfigurationError);
        expect(captured.message).not.toContain(exposedSecret);
    });

    test('el modo test usa valores ficticios internos sin necesitar infraestructura', () => {
        const config = loadConfig({ NODE_ENV: 'test' });

        expect(config.app.trustProxy).toBe(false);
        expect(config.security.jwtSecret).toMatch(/^test-only-/);
        expect(config.email.provider).toBe('memory');
    });

    test('un rol con pagos requiere tres conexiones y un rol API admite dos', () => {
        expect(() => loadConfig({ NODE_ENV: 'test', PROCESS_ROLE: 'all', MYSQL_CONNECTION_LIMIT: '2' }))
            .toThrow(ConfigurationError);
        expect(loadConfig({ NODE_ENV: 'test', PROCESS_ROLE: 'api', MYSQL_CONNECTION_LIMIT: '2' }).mysql.connectionLimit)
            .toBe(2);
    });
});

function createCorsTestApp(allowedOrigins) {
    const app = express();
    app.use(cors(createCorsOptions(allowedOrigins)));
    app.get('/resource', (req, res) => res.status(200).json({ ok: true }));
    app.use(globalErrorHandler);
    return app;
}

describe('CORS configurable en Express', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('permite un origen exacto y devuelve credenciales', async () => {
        const response = await request(createCorsTestApp(['https://app.lottery.example']))
            .get('/resource')
            .set('Origin', 'https://app.lottery.example');

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe('https://app.lottery.example');
        expect(response.headers['access-control-allow-credentials']).toBe('true');
        expect(response.headers['access-control-expose-headers']).toBe('Content-Disposition');
    });

    test('rechaza dominios parecidos que no están en la allowlist', async () => {
        jest.spyOn(logger, 'warn').mockImplementation(() => {});
        const response = await request(createCorsTestApp(['https://app.lottery.example']))
            .get('/resource')
            .set('Origin', 'https://app.lottery.example.evil.test');

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
            success: false,
            code: 'CORS_ORIGIN_DENIED',
            message: 'El origen de la solicitud no está permitido'
        });
    });

    test('permite solicitudes sin Origin y preflight autorizado', async () => {
        const app = createCorsTestApp(['https://app.lottery.example']);
        const withoutOrigin = await request(app).get('/resource');
        const preflight = await request(app)
            .options('/resource')
            .set('Origin', 'https://app.lottery.example')
            .set('Access-Control-Request-Method', 'GET');

        expect(withoutOrigin.status).toBe(200);
        expect(preflight.status).toBe(204);
        expect(preflight.headers['access-control-allow-origin']).toBe('https://app.lottery.example');
    });
});

function createIpApp(trustProxy) {
    const app = express();
    app.set('trust proxy', trustProxy);
    app.get('/ip', (req, res) => res.json({ ip: req.ip, ips: req.ips }));
    return app;
}

describe('interpretación de IP controlada por trust proxy', () => {
    test('false ignora X-Forwarded-For proporcionado por el cliente', async () => {
        const response = await request(createIpApp(false))
            .get('/ip')
            .set('X-Forwarded-For', '198.51.100.25');

        expect(response.body.ip).not.toBe('198.51.100.25');
        expect(response.body.ips).toEqual([]);
    });

    test.each(['loopback', 1])('%s confía en el salto configurado', async trustProxy => {
        const response = await request(createIpApp(trustProxy))
            .get('/ip')
            .set('X-Forwarded-For', '198.51.100.25');

        expect(response.body.ip).toBe('198.51.100.25');
        expect(response.body.ips).toContain('198.51.100.25');
    });
});

describe('arranque secuencial', () => {
    test('inicializa base, reglas y aplicación en ese orden', async () => {
        const order = [];
        const app = { marker: true };

        const result = await prepareApplication({
            initializeDatabase: jest.fn(async () => order.push('database')),
            loadSettings: jest.fn(async () => order.push('settings')),
            createApplication: jest.fn(() => {
                order.push('application');
                return app;
            })
        });

        expect(order).toEqual(['database', 'settings', 'application']);
        expect(result).toBe(app);
    });

    test('no carga reglas ni crea la aplicación si MySQL falla', async () => {
        const loadSettings = jest.fn();
        const createApplication = jest.fn();

        await expect(prepareApplication({
            initializeDatabase: jest.fn().mockRejectedValue(new Error('database unavailable')),
            loadSettings,
            createApplication
        })).rejects.toThrow('database unavailable');

        expect(loadSettings).not.toHaveBeenCalled();
        expect(createApplication).not.toHaveBeenCalled();
    });

    test('no crea la aplicación si las reglas no cargan', async () => {
        const createApplication = jest.fn();

        await expect(prepareApplication({
            initializeDatabase: jest.fn(),
            loadSettings: jest.fn().mockRejectedValue(new Error('settings unavailable')),
            createApplication
        })).rejects.toThrow('settings unavailable');

        expect(createApplication).not.toHaveBeenCalled();
    });
});

describe('texto KYC y metadata técnica', () => {
    test.each([
        "María José O'Connor-López",
        'José de la Cruz',
        'Ana M. Pérez',
        '李 小龍'
    ])('acepta el nombre legítimo %s', fullName => {
        const result = submitKycSchema.validate({ full_name: fullName, dni: '123456789' });

        expect(result.error).toBeUndefined();
    });

    test.each(['<script>Ana</script>', 'Ana\nPérez', 'Ana123 Pérez'])(
        'rechaza el nombre peligroso o inválido %s', fullName => {
            expect(submitKycSchema.validate({ full_name: fullName, dni: '123456789' }).error)
                .toBeDefined();
        }
    );

    test('normaliza y limita User-Agent sin rechazar la operación', () => {
        const dangerous = `  Navegador<script>\u0000Jose\u0301${'x'.repeat(300)}  `;
        const normalized = normalizeDevice(dangerous);

        expect(normalized).not.toMatch(/[<>\u0000-\u001F]/);
        expect(normalized).toContain('José');
        expect(Array.from(normalized)).toHaveLength(255);
        expect(normalizeDevice(undefined)).toBe('unknown');
    });
});

describe('logging seguro de errores inesperados', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('no registra query strings, SQL, mensajes internos ni cuerpos sensibles', () => {
        const errorLogger = jest.spyOn(logger, 'error').mockImplementation(() => {});
        const error = new Error('SELECT password FROM users WHERE token=secret-token');
        error.code = 'ER_INTERNAL';
        error.statusCode = 500;
        const req = {
            originalUrl: '/failure?token=secret-token',
            method: 'POST',
            ip: '127.0.0.1',
            body: { password: 'secret-token', safe: true }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        globalErrorHandler(error, req, res, jest.fn());

        const serializedLog = JSON.stringify(errorLogger.mock.calls[0]);
        expect(serializedLog).not.toContain('SELECT password');
        expect(serializedLog).not.toContain('secret-token');
        expect(serializedLog).not.toContain('?token=');
        expect(serializedLog).toContain('[REDACTED]');
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0]).toEqual({
            success: false,
            message: 'Ha ocurrido un error inesperado en el servidor. Por favor, intente más tarde.'
        });
    });
});
