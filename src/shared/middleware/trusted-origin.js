import config from '../../../config.js';

export function requireTrustedOrigin(req, res, next) {
    const origin = req.get('Origin');
    if (!origin && config.app.environment !== 'production') return next();
    if (origin && config.security.corsAllowedOrigins.includes(origin)) return next();

    const error = new Error('El origen de la solicitud de sesión no está permitido');
    error.statusCode = 403;
    error.publicCode = 'SESSION_ORIGIN_DENIED';
    next(error);
}
