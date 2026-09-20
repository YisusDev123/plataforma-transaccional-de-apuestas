import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import {
    cambiarContraseña,
    olvideContraseña,
    reenviarVerificacionEmail,
    registrarUsuario,
    verificarEmail
} from '../modules/auth/auth-services.js'
import { iniciarBaseDeDatos } from '../shared/database/auth-SQL.js'
import { generateAuthCode, hashAuthCode } from '../shared/email/auth-code.js'
import { createEmailProvider, EmailDeliveryError } from '../shared/email/email-provider.js'
import { logger } from '../shared/error/winston.js'

const email = 'usuario@example.com'

beforeEach(() => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
    jest.restoreAllMocks()
})

function mockEmailProvider(overrides = {}) {
    return {
        name: 'test',
        sendVerificationCode: jest.fn().mockResolvedValue({ id: 'email-1' }),
        sendPasswordResetCode: jest.fn().mockResolvedValue({ id: 'email-2' }),
        ...overrides,
    }
}

describe('códigos de autenticación por correo', () => {
    test('genera seis dígitos y almacena un HMAC separado por propósito', () => {
        const code = generateAuthCode()
        const secret = 'test-only-code-secret-with-more-than-32-bytes'
        const verificationHash = hashAuthCode({ purpose: 'email_verification', identity: email, code, secret })
        const resetHash = hashAuthCode({ purpose: 'password_reset', identity: email, code, secret })

        expect(code).toMatch(/^\d{6}$/)
        expect(verificationHash).toMatch(/^[a-f0-9]{64}$/)
        expect(resetHash).toMatch(/^[a-f0-9]{64}$/)
        expect(resetHash).not.toBe(verificationHash)
        expect(verificationHash).not.toContain(code)
    })

    test('registro persiste sólo el hash y envía el código una vez', async () => {
        const database = {
            existeEmailEnSistema: jest.fn().mockResolvedValue(null),
            registrarUsuarioTransaccional: jest.fn().mockResolvedValue({ id: 7, email, verificationId: 31 })
        }
        const provider = mockEmailProvider()

        await expect(registrarUsuario(database, provider, email, 'password-seguro'))
            .resolves.toMatchObject({ message: expect.stringContaining('VERIFIQUE SU CORREO') })

        const storedHash = database.registrarUsuarioTransaccional.mock.calls[0][2]
        const delivery = provider.sendVerificationCode.mock.calls[0][0]
        expect(storedHash).toMatch(/^[a-f0-9]{64}$/)
        expect(delivery.code).toMatch(/^\d{6}$/)
        expect(storedHash).not.toBe(delivery.code)
        expect(delivery).toMatchObject({ to: email, idempotencyKey: 'email_verification_31' })
        expect(provider.sendVerificationCode).toHaveBeenCalledTimes(1)
    })

    test('un fallo inicial de correo no revierte una cuenta ya creada', async () => {
        const database = {
            existeEmailEnSistema: jest.fn().mockResolvedValue(null),
            registrarUsuarioTransaccional: jest.fn().mockResolvedValue({ id: 7, email, verificationId: 31 })
        }
        const provider = mockEmailProvider({
            sendVerificationCode: jest.fn().mockRejectedValue(new EmailDeliveryError())
        })

        await expect(registrarUsuario(database, provider, email, 'password-seguro')).resolves.toBeDefined()
    })

    test('reenvío reemplaza el código atómicamente y comunica indisponibilidad del proveedor', async () => {
        const database = {
            buscarUsuarioPorEmail: jest.fn().mockResolvedValue({ id: 7, email_verified: 0 }),
            reemplazarCodigoVerificacionTransaccional: jest.fn().mockResolvedValue(44)
        }
        const provider = mockEmailProvider({
            sendVerificationCode: jest.fn().mockRejectedValue(new EmailDeliveryError())
        })

        await expect(reenviarVerificacionEmail(database, provider, email))
            .rejects.toMatchObject({ statusCode: 503, publicCode: 'EMAIL_DELIVERY_UNAVAILABLE' })
        expect(database.reemplazarCodigoVerificacionTransaccional).toHaveBeenCalledTimes(1)
    })

    test('recuperación responde igual para cuenta inexistente y fallo de entrega', async () => {
        const missingDatabase = { buscarUsuarioPorEmail: jest.fn().mockResolvedValue(null) }
        const existingDatabase = {
            buscarUsuarioPorEmail: jest.fn().mockResolvedValue({ id: 7 }),
            reemplazarCodigoResetTransaccional: jest.fn().mockResolvedValue(55)
        }
        const provider = mockEmailProvider({
            sendPasswordResetCode: jest.fn().mockRejectedValue(new EmailDeliveryError())
        })

        const missing = await olvideContraseña(missingDatabase, provider, email)
        const existing = await olvideContraseña(existingDatabase, provider, email)
        expect(existing).toEqual(missing)
        expect(provider.sendPasswordResetCode).toHaveBeenCalledTimes(1)
    })

    test('verificación y cambio de contraseña buscan el HMAC, nunca el código recibido', async () => {
        const verificationDatabase = {
            buscarUsuarioPorEmail: jest.fn().mockResolvedValue({ id: 7, email_verified: 0 }),
            verificarEmailTransaccional: jest.fn().mockResolvedValue(true)
        }
        await verificarEmail(verificationDatabase, email, '123456')
        expect(verificationDatabase.verificarEmailTransaccional.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/)
        expect(verificationDatabase.verificarEmailTransaccional.mock.calls[0][1]).not.toBe('123456')

        const resetDatabase = {
            buscarUsuarioPorEmail: jest.fn().mockResolvedValue({ id: 7 }),
            buscarCodigoResetPassword: jest.fn().mockResolvedValue({ id: 9, expires_at: new Date(Date.now() + 60_000) }),
            resetPasswordTransaccional: jest.fn()
        }
        await cambiarContraseña(resetDatabase, email, '654321', 'nueva-password')
        expect(resetDatabase.buscarCodigoResetPassword.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/)
        expect(resetDatabase.buscarCodigoResetPassword.mock.calls[0][1]).not.toBe('654321')
    })
})

describe('proveedor Twilio Email', () => {
    const config = Object.freeze({
        provider: 'twilio',
        apiKeySid: 'SK00000000000000000000000000000000',
        apiKeySecret: 'twilio-test-secret-with-more-than-32-bytes',
        from: Object.freeze({ name: 'Loto Demo', address: 'seguridad@example.com' }),
        requestTimeoutMs: 5000
    })

    test('envía texto y HTML con autenticación mínima y correlación sin exponer secretos', async () => {
        const fetchImpl = jest.fn().mockResolvedValue(new Response(JSON.stringify({
            operationId: 'comms_operation_test_1',
            operationLocation: 'https://comms.twilio.com/v1/Emails/Operations/comms_operation_test_1'
        }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
        }))
        const provider = createEmailProvider(config, { fetchImpl })

        const result = await provider.sendVerificationCode({
            to: email, code: '123456', idempotencyKey: 'email_verification_1'
        })
        expect(result).toEqual({ id: 'comms_operation_test_1', skipped: false })

        expect(fetchImpl.mock.calls[0][0]).toBe('https://comms.twilio.com/v1/Emails')
        const request = fetchImpl.mock.calls[0][1]
        const body = JSON.parse(request.body)
        expect(request.method).toBe('POST')
        expect(request.headers.Authorization).toBe(`Basic ${Buffer.from(
            `${config.apiKeySid}:${config.apiKeySecret}`, 'utf8'
        ).toString('base64')}`)
        expect(body).toMatchObject({
            from: { name: 'Loto Demo', address: 'seguridad@example.com' },
            to: [{ address: email }],
            tags: { category: 'email_verification', request_id: 'email_verification_1' }
        })
        expect(body).not.toHaveProperty('reply_to')
        for (const digit of '123456') expect(body.content.html).toContain(`>${digit}</span>`)
        expect(body.content.text).toContain('Código: 123456')
        expect(body.content.html).toContain('Loto Demo')
        expect(JSON.stringify(result)).not.toContain(config.apiKeySecret)
    })

    test.each([
        [429, 'EMAIL_PROVIDER_HTTP_429'],
        [500, 'EMAIL_PROVIDER_HTTP_500']
    ])('normaliza respuesta HTTP %s sin propagar el cuerpo del proveedor', async (status, code) => {
        const fetchImpl = jest.fn().mockResolvedValue(new Response('detalle interno sensible', { status }))
        const provider = createEmailProvider(config, { fetchImpl })

        await expect(provider.sendVerificationCode({
            to: email, code: '123456', idempotencyKey: 'email_verification_1'
        })).rejects.toMatchObject({ code, publicCode: 'EMAIL_DELIVERY_UNAVAILABLE', statusCode: 503 })
    })

    test('rechaza una aceptación sin operationId', async () => {
        const fetchImpl = jest.fn().mockResolvedValue(new Response('{}', {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
        }))
        const provider = createEmailProvider(config, { fetchImpl })

        await expect(provider.sendVerificationCode({
            to: email, code: '123456', idempotencyKey: 'email_verification_1'
        })).rejects.toMatchObject({ code: 'EMAIL_PROVIDER_INVALID_RESPONSE' })
    })

    test.each([
        [Object.assign(new Error('aborted'), { name: 'AbortError' }), 'EMAIL_PROVIDER_TIMEOUT'],
        [new Error('socket failure'), 'EMAIL_PROVIDER_NETWORK_ERROR']
    ])('normaliza fallos de transporte', async (error, code) => {
        const provider = createEmailProvider(config, {
            fetchImpl: jest.fn().mockRejectedValue(error)
        })

        await expect(provider.sendVerificationCode({
            to: email, code: '123456', idempotencyKey: 'email_verification_1'
        })).rejects.toMatchObject({ code })
    })

    test('clasifica recuperación de contraseña sin cambiar la interfaz del módulo', async () => {
        const fetchImpl = jest.fn().mockResolvedValue(new Response(JSON.stringify({
            operationId: 'comms_operation_reset_1'
        }), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
        }))
        const provider = createEmailProvider(config, { fetchImpl })

        await expect(provider.sendPasswordResetCode({
            to: email, code: '654321', idempotencyKey: 'password_reset_2'
        })).resolves.toEqual({ id: 'comms_operation_reset_1', skipped: false })

        const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
        expect(body.tags).toEqual({ category: 'password_reset', request_id: 'password_reset_2' })
        expect(body.content.subject).toContain('restablecer')
        expect(body.content.text).toContain('Código: 654321')
    })
})

describe('reemplazo transaccional de códigos', () => {
    test.each([
        ['verificación', 'reemplazarCodigoVerificacionTransaccional', 'email_verifications'],
        ['recuperación', 'reemplazarCodigoResetTransaccional', 'password_resets']
    ])('%s bloquea usuario, expira el código anterior y crea uno nuevo', async (_name, method, table) => {
        const connection = {
            beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
            query: jest.fn(async sql => {
                if (sql.includes('SELECT id FROM users')) return [[{ id: 7 }]]
                if (sql.includes(`UPDATE ${table}`)) return [{ affectedRows: 1 }]
                if (sql.includes(`INSERT INTO ${table}`)) return [{ affectedRows: 1, insertId: 88 }]
                throw new Error(`Consulta inesperada: ${sql}`)
            })
        }
        const database = iniciarBaseDeDatos({ getConnection: jest.fn().mockResolvedValue(connection) })

        await expect(database[method](7, 'a'.repeat(64))).resolves.toBe(88)
        const queries = connection.query.mock.calls.map(([sql]) => sql.trim())
        expect(queries.some(sql => sql.startsWith('SELECT id FROM users'))).toBe(true)
        expect(queries.some(sql => sql.startsWith(`UPDATE ${table}`))).toBe(true)
        expect(queries.some(sql => sql.startsWith(`INSERT INTO ${table}`))).toBe(true)
        expect(connection.commit).toHaveBeenCalledTimes(1)
        expect(connection.rollback).not.toHaveBeenCalled()
        expect(connection.release).toHaveBeenCalledTimes(1)
    })
})
