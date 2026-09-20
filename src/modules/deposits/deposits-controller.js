import { success } from "../../shared/utils/response.js";
import { createPaginationMetadata } from "../../shared/utils/pagination.js";

export function iniciarDepositoController(servicioDeposito, baseDeDatosDeposito, baseDeDatosUsers, settingsService) {
    return {
        async create(req, res, next) {
            try {
                const userId = req.userId;
                const { amount, referenceNumber, requestId, destinationId } = req.body
                const datosSaneados = { amount, referenceNumber, requestId, destinationId };

                const contenido = await servicioDeposito.solicitarDeposito(baseDeDatosDeposito, baseDeDatosUsers, settingsService, userId, datosSaneados);
                success(req, res, contenido, 201);
            }catch (error) {
                next(error);
            }
        },

        async list(req, res, next) {
            try {
                const { status, requestId } = req.validated.query;
                const { page, limit, offset } = req.pagination;
                const result = await servicioDeposito.listarDepositos(
                    baseDeDatosDeposito, req.userId, { status, requestId }, limit, offset
                );
                success(req, res, {
                    deposits: result.deposits,
                    pagination: createPaginationMetadata({ totalItems: result.total, page, limit })
                }, 200);
            } catch (error) {
                next(error);
            }
        },

        async detail(req, res, next) {
            try {
                const result = await servicioDeposito.obtenerDeposito(baseDeDatosDeposito, req.userId, req.params.id);
                success(req, res, result, 200);
            } catch (error) {
                next(error);
            }
        },

    };
}
