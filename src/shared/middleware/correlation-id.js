import { randomUUID } from 'node:crypto';

const SAFE_CORRELATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function correlationId(req, res, next) {
    const supplied = req.get('x-correlation-id');
    req.correlationId = typeof supplied === 'string' && SAFE_CORRELATION_ID.test(supplied)
        ? supplied
        : randomUUID();
    res.set('X-Correlation-Id', req.correlationId);
    next();
}
