
export function extraerPaginacion(req, res, next) {
    const { page, limit } = req.validated.query;

    req.pagination = {
        page,
        limit,
        offset: (page - 1) * limit
    };

    next();
}
