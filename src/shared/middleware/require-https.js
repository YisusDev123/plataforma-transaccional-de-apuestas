export function requireHttps(runtimeConfig) {
    return (req, res, next) => {
        if (!runtimeConfig.app.requireHttps || req.secure) return next();
        const error = new Error('Esta operación requiere una conexión HTTPS.');
        error.statusCode = 426;
        error.publicCode = 'HTTPS_REQUIRED';
        next(error);
    };
}
