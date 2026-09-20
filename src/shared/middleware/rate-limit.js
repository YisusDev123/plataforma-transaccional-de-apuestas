import { createHash } from 'node:crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const RATE_LIMIT_MESSAGE = {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Has realizado demasiadas solicitudes. Intenta nuevamente más tarde.'
};

function ipRateLimitKey(req) {
    return `ip:${ipKeyGenerator(req.ip)}`;
}

function emailIpRateLimitKey(req) {
    const email = req.validated?.body?.email ?? req.body?.email;

    if (typeof email !== 'string' || email.trim() === '') {
        return ipRateLimitKey(req);
    }

    const emailHash = createHash('sha256')
        .update(email.trim().toLowerCase())
        .digest('hex');

    return `${ipRateLimitKey(req)}:email:${emailHash}`;
}

export function userRateLimitKey(req) {
    return req.userId ? `user:${String(req.userId)}` : ipRateLimitKey(req);
}

export function adminRateLimitKey(req) {
    return req.admin?.id ? `admin:${String(req.admin.id)}` : ipRateLimitKey(req);
}

export function crearRateLimiter({
    windowMs,
    max,
    identifier,
    keyGenerator = ipRateLimitKey,
    skipSuccessfulRequests = false
}) {
    return rateLimit({
        windowMs,
        limit: max,
        identifier,
        keyGenerator,
        skipSuccessfulRequests,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (req, res) => res.status(429).json(RATE_LIMIT_MESSAGE)
    });
}

export const globalLimiter = crearRateLimiter({ windowMs: 15 * 60 * 1000, max: 1000, identifier: 'global-api' });

export const userLoginIpLimiter = crearRateLimiter({
    windowMs: 15 * 60 * 1000, max: 30, identifier: 'user-login-ip', skipSuccessfulRequests: true
});
export const userLoginAccountLimiter = crearRateLimiter({
    windowMs: 15 * 60 * 1000, max: 10, identifier: 'user-login-account',
    keyGenerator: emailIpRateLimitKey, skipSuccessfulRequests: true
});
export const adminLoginIpLimiter = crearRateLimiter({
    windowMs: 15 * 60 * 1000, max: 15, identifier: 'admin-login-ip', skipSuccessfulRequests: true
});
export const adminLoginAccountLimiter = crearRateLimiter({
    windowMs: 15 * 60 * 1000, max: 5, identifier: 'admin-login-account',
    keyGenerator: emailIpRateLimitKey, skipSuccessfulRequests: true
});
export const registerLimiter = crearRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, identifier: 'user-register' });
export const emailCodeIpLimiter = crearRateLimiter({ windowMs: 60 * 60 * 1000, max: 30, identifier: 'email-code-ip' });
export const emailCodeAccountLimiter = crearRateLimiter({
    windowMs: 60 * 60 * 1000, max: 5, identifier: 'email-code-account', keyGenerator: emailIpRateLimitKey
});
export const sessionLimiter = crearRateLimiter({ windowMs: 15 * 60 * 1000, max: 60, identifier: 'session' });
export const drawReadLimiter = crearRateLimiter({
    windowMs: 60 * 1000, max: 120, identifier: 'draw-read', keyGenerator: userRateLimitKey
});
export const betLimiter = crearRateLimiter({
    windowMs: 60 * 1000, max: 30, identifier: 'bet-place', keyGenerator: userRateLimitKey
});
export const depositLimiter = crearRateLimiter({
    windowMs: 60 * 60 * 1000, max: 10, identifier: 'deposit-create', keyGenerator: userRateLimitKey
});
export const withdrawalLimiter = crearRateLimiter({
    windowMs: 60 * 60 * 1000, max: 5, identifier: 'withdrawal-request', keyGenerator: userRateLimitKey
});
export const walletLimiter = crearRateLimiter({
    windowMs: 60 * 1000, max: 60, identifier: 'wallet-read', keyGenerator: userRateLimitKey
});
export const financialReadLimiter = crearRateLimiter({
    windowMs: 60 * 1000, max: 120, identifier: 'financial-read', keyGenerator: userRateLimitKey
});
export const adminFinancialReadLimiter = crearRateLimiter({
    windowMs: 15 * 60 * 1000, max: 240, identifier: 'admin-financial-read', keyGenerator: adminRateLimitKey
});
export const kycLimiter = crearRateLimiter({
    windowMs: 60 * 60 * 1000, max: 5, identifier: 'kyc-submit', keyGenerator: userRateLimitKey
});
export const adminOperationLimiter = crearRateLimiter({
    windowMs: 15 * 60 * 1000, max: 120, identifier: 'admin-operation', keyGenerator: adminRateLimitKey
});
export const superAdminReadLimiter = crearRateLimiter({
    windowMs: 15 * 60 * 1000, max: 120, identifier: 'super-admin-read', keyGenerator: adminRateLimitKey
});
export const superAdminOperationLimiter = crearRateLimiter({
    windowMs: 15 * 60 * 1000, max: 20, identifier: 'super-admin-operation', keyGenerator: adminRateLimitKey
});
