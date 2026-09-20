const SENSITIVE_FIELDS = new Set([
    'password',
    'token',
    'jwt',
    'secret',
    'pin',
    'authorization',
    'refreshtoken',
    'refresh_token',
    'accesstoken',
    'access_token',
    'newpassword',
    'new_password',
    'verificationcode',
    'verification_code',
    'resetcode',
    'reset_code',
    'dni',
    'destinationaccount',
    'destination_account',
    'destinationaccountholder',
    'destination_account_holder',
    'destinationvalue',
    'destination_value',
    'accountholder',
    'account_holder',
    'withdrawal_account_snapshot',
    'referencenumber',
    'reference_number'
]);

export function sanitizeBody(body) {
    return sanitizeValue(body, new WeakSet(), 0);
}

function sanitizeValue(value, seen, depth) {
    if (!value || typeof value !== 'object') return value;
    if (depth >= 10) return '[MAX_DEPTH]';
    if (seen.has(value)) return '[CIRCULAR]';

    seen.add(value);

    if (Array.isArray(value)) {
        const sanitizedArray = value.map(item => sanitizeValue(item, seen, depth + 1));
        seen.delete(value);
        return sanitizedArray;
    }

    const sanitized = {};
    for (const [key, nestedValue] of Object.entries(value)) {
        if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
            sanitized[key] = '[REDACTED]';
        } else {
            sanitized[key] = sanitizeValue(nestedValue, seen, depth + 1);
        }
    }

    seen.delete(value);
    return sanitized;
}
