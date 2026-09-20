import crypto from 'crypto'

const AUTH_CODE_PATTERN = /^\d{6}$/

export function generateAuthCode() {
    return crypto.randomInt(100000, 1000000).toString()
}

export function hashAuthCode({ purpose, identity, code, secret }) {
    if (!['email_verification', 'password_reset'].includes(purpose)) {
        throw new TypeError('Propósito de código no válido')
    }
    if (typeof identity !== 'string' || identity.trim() === '') {
        throw new TypeError('Identidad de código no válida')
    }
    if (!AUTH_CODE_PATTERN.test(String(code))) {
        throw new TypeError('Código de autenticación no válido')
    }

    return crypto
        .createHmac('sha256', secret)
        .update(`${purpose}:${identity.trim().toLowerCase()}:${code}`)
        .digest('hex')
}
