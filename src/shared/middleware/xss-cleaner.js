import xss from 'xss';

/**
 * Función recursiva que recorre strings, arrays y objetos
 * para limpiar cualquier intento de inyección de código (HTML/JS).
 */
const sanitize = (data) => {
    if (typeof data === 'string') {
        return xss(data);
    }

    if (Array.isArray(data)) {
        return data.map((item) => sanitize(item));
    }

    if (typeof data === 'object' && data !== null) {
        Object.keys(data).forEach((key) => {
            data[key] = sanitize(data[key]);
        });
    }

    return data;
};

/**
 * Middleware XSS global para Express
 */
export function xssCleaner(req, res, next) {
    if (req.body) req.body = sanitize(req.body);
    if (req.query) {
        req.validated = req.validated || {};
        req.validated.query = sanitize({ ...req.query });
    }
    if (req.params) req.params = sanitize(req.params);

    next();
}
