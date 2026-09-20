import jwt from "jsonwebtoken";
import config from '../../../config.js';

export const iniciarAuthMiddleware = (baseDeDatos) => {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                const error = new Error("Token no proporcionado");
                error.statusCode = 401;
                throw error;
            }

            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, config.security.jwtSecret);

            if (decoded.type !== "admin") {
                const error = new Error("Acceso denegado: no eres Administrador");
                error.statusCode = 403;
                throw error;
            }

            const sesionActiva = await baseDeDatos.buscarSesionActiva(decoded.sessionId, decoded.adminId);

            if (!sesionActiva) {
                const error = new Error("Sesión expirada o revocada");
                error.statusCode = 401;
                throw error;
            }

            req.admin = {
                id: decoded.adminId,
                email: sesionActiva.email,
                role: sesionActiva.role,
                sessionId: decoded.sessionId
            };
            next();

        } catch (error) {
            if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
                error.statusCode = 401;
            }
            next(error);
        }
    };
};

export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.admin || !allowedRoles.includes(req.admin.role)) {
            const error = new Error("NO TIENES PERMISOS PARA ESTA ACCIÓN");
            error.statusCode = 403;
            throw error;
        }
        next();
            }catch (error) {
            next(error);
            }
    };
};
