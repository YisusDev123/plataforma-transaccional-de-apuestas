import { passwordResetEmail, verificationEmail } from './email-templates.js'

export class EmailDeliveryError extends Error {
    constructor(code = 'EMAIL_PROVIDER_UNAVAILABLE') {
        super('No fue posible enviar el correo en este momento.')
        this.name = 'EmailDeliveryError'
        this.code = code
        this.statusCode = 503
        this.publicCode = 'EMAIL_DELIVERY_UNAVAILABLE'
    }
}

function createTwilioProvider(config, fetchImpl) {
    async function send({ to, template, idempotencyKey, category }) {
        let response
        try {
            const credentials = Buffer.from(`${config.apiKeySid}:${config.apiKeySecret}`, 'utf8').toString('base64')
            response = await fetchImpl('https://comms.twilio.com/v1/Emails', {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: config.from,
                    to: [{ address: to }],
                    content: {
                        subject: template.subject,
                        html: template.html,
                        text: template.text,
                    },
                    tags: {
                        category,
                        request_id: idempotencyKey,
                    },
                }),
                signal: AbortSignal.timeout(config.requestTimeoutMs),
            })
        } catch (error) {
            const code = error?.name === 'TimeoutError' || error?.name === 'AbortError'
                ? 'EMAIL_PROVIDER_TIMEOUT'
                : 'EMAIL_PROVIDER_NETWORK_ERROR'
            throw new EmailDeliveryError(code)
        }

        if (response.status !== 202) {
            throw new EmailDeliveryError(`EMAIL_PROVIDER_HTTP_${response.status}`)
        }

        const result = await response.json().catch(() => ({}))
        if (typeof result.operationId !== 'string' || result.operationId.trim() === '') {
            throw new EmailDeliveryError('EMAIL_PROVIDER_INVALID_RESPONSE')
        }
        return { id: result.operationId, skipped: false }
    }

    return Object.freeze({
        name: 'twilio',
        sendVerificationCode: ({ to, code, idempotencyKey }) => send({
            to, idempotencyKey, template: verificationEmail({ code }), category: 'email_verification'
        }),
        sendPasswordResetCode: ({ to, code, idempotencyKey }) => send({
            to, idempotencyKey, template: passwordResetEmail({ code }), category: 'password_reset'
        }),
    })
}

function createMemoryProvider() {
    const messages = []
    const save = async (type, payload) => {
        messages.push(Object.freeze({ type, ...payload }))
        return { id: `memory-${messages.length}`, skipped: false }
    }
    return Object.freeze({
        name: 'memory',
        sendVerificationCode: payload => save('email_verification', payload),
        sendPasswordResetCode: payload => save('password_reset', payload),
        getLatestCode({ to, type }) {
            return messages.findLast(message => message.to === to && message.type === type)?.code ?? null
        },
        clear() {
            messages.length = 0
        },
    })
}

function createDisabledProvider() {
    const skip = async () => ({ id: null, skipped: true })
    return Object.freeze({
        name: 'disabled',
        sendVerificationCode: skip,
        sendPasswordResetCode: skip,
    })
}

export function createEmailProvider(config, { fetchImpl = globalThis.fetch } = {}) {
    if (config.provider === 'memory') return createMemoryProvider()
    if (config.provider === 'disabled') return createDisabledProvider()
    if (config.provider === 'twilio') {
        if (typeof fetchImpl !== 'function') throw new TypeError('Fetch no está disponible para el proveedor de correo')
        return createTwilioProvider(config, fetchImpl)
    }
    throw new TypeError('Proveedor de correo no compatible')
}
