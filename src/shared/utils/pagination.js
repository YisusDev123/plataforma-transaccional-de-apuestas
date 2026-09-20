export function createPaginationMetadata({ totalItems, page, limit }) {
    const normalizedTotal = Number(totalItems) || 0;

    return {
        totalItems: normalizedTotal,
        currentPage: page,
        totalPages: normalizedTotal === 0 ? 0 : Math.ceil(normalizedTotal / limit),
        limit
    };
}
