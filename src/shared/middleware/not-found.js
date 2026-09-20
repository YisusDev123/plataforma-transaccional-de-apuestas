export function notFoundHandler(req, res) {
    return res.status(404).json({
        success: false,
        code: 'ROUTE_NOT_FOUND',
        message: 'La ruta solicitada no existe'
    });
}
