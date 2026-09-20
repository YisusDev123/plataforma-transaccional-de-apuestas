import jwt from 'jsonwebtoken';
import config from '../../../config.js';

export function iniciarAuthMiddleware(baseDeDatos) {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            const error = new Error("Token no proporcionado o formato inválido");
            error.statusCode = 401;
            return next(error);
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, config.security.jwtSecret);

            const sesionActiva = await baseDeDatos.buscarSesionActiva(decoded.sessionId);

            if (!sesionActiva || String(sesionActiva.user_id) !== String(decoded.userId)){
                const error = new Error("Sesión expirada o revocada");
                error.statusCode = 401;
                return next(error);
            }

            req.userId = decoded.userId;
            req.sessionId = decoded.sessionId;
            next();
        } catch (error) {
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
                error.statusCode = 401;
            }
            next(error);
        }
    };
}
