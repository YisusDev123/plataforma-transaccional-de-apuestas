export function createCorsOptions(allowedOrigins) {
    const allowed = new Set(allowedOrigins);

    return {
        origin(origin, callback) {
            if (!origin || allowed.has(origin)) {
                return callback(null, true);
            }

            const error = new Error('El origen de la solicitud no está permitido');
            error.statusCode = 403;
            error.publicCode = 'CORS_ORIGIN_DENIED';
            return callback(error);
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        exposedHeaders: ['Content-Disposition'],
        credentials: true,
        optionsSuccessStatus: 204
    };
}
