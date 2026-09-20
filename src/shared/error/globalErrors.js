import { logger } from './winston.js';
import { sanitizeBody } from './../utils/omitir.js';

export function globalErrorHandler(err, req, res, _next) {
    const isPoolSaturated = err?.code === 'POOL_QUEUE_LIMIT'
        || err?.code === 'POOL_ACQUIRE_TIMEOUT'
        || err?.code === 'DATABASE_QUERY_TIMEOUT'
        || err?.code === 'ER_LOCK_WAIT_TIMEOUT'
        || err?.code === 'ER_MAX_EXECUTION_TIME_EXCEEDED'
        || err?.message === 'Queue limit reached.';
    const statusCode = isPoolSaturated ? 503 : Number(err.statusCode);
    if (isPoolSaturated) {
        err = Object.assign(new Error('El servicio está temporalmente ocupado. Intenta nuevamente.'), {
            statusCode: 503,
            publicCode: 'SERVICE_BUSY'
        });
    }
    const isOperational = (statusCode >= 400 && statusCode < 500)
        || (statusCode === 503 && typeof err.publicCode === 'string');
    const authenticatedActor = req.admin?.id
        ? { type: 'ADMIN', id: req.admin.id }
        : req.userId
            ? { type: 'USER', id: req.userId }
            : null;

    const metadata = {
        route: req.path || req.originalUrl?.split('?')[0],
        method: req.method,
        ip: req.ip,
        authenticatedActor,
        request_body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
        correlationId: req.correlationId,
    };

    if (!isOperational) {
        metadata.error = {
            type: err.name || 'Error',
            code: typeof err.code === 'string' ? err.code : undefined
        };
        metadata.stack_trace = typeof err.stack === 'string'
            ? err.stack.split('\n').slice(1).join('\n')
            : undefined;
    }

    if (isOperational) {
        logger.warn(err.message, { metadata });

        return res.status(statusCode).json({
            success: false,
            ...(err.publicCode ? { code: err.publicCode } : {}),
            message: err.message
        });
    } else {
        logger.error('Error inesperado del servidor', { metadata });

        return res.status(500).json({
            success: false,
            message: "Ha ocurrido un error inesperado en el servidor. Por favor, intente más tarde."
        });
    }
}
