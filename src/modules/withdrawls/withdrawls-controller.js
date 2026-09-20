import { success } from "../../shared/utils/response.js";
import { createPaginationMetadata } from "../../shared/utils/pagination.js";

export function iniciarWithdrawalsController(servicioRetiro, baseDeDatosWithdrawals, baseDeDatosUsers, settingsService) {
    return {
        async request(req, res, next) {
            try {
                const userId = req.userId;
                const { amount, destinationAccount, destinationAccountHolder, requestId } = req.body;

                const contenido = await servicioRetiro.solicitarRetiro(baseDeDatosWithdrawals, baseDeDatosUsers, settingsService, userId, {
                    amount: String(amount),
                    destinationAccount,
                    destinationAccountHolder,
                    requestId
                });

                return success(req, res, contenido, 201);
            } catch (error) {
                next(error);
            }
        },

        async list(req, res, next) {
            try {
                const { status, requestId } = req.validated.query;
                const { page, limit, offset } = req.pagination;
                const result = await servicioRetiro.listarRetiros(
                    baseDeDatosWithdrawals, req.userId, { status, requestId }, limit, offset
                );
                success(req, res, {
                    withdrawals: result.withdrawals,
                    pagination: createPaginationMetadata({ totalItems: result.total, page, limit })
                }, 200);
            } catch (error) {
                next(error);
            }
        },

        async detail(req, res, next) {
            try {
                const result = await servicioRetiro.obtenerRetiro(baseDeDatosWithdrawals, req.userId, req.params.id);
                success(req, res, result, 200);
            } catch (error) {
                next(error);
            }
        }
    };
}
