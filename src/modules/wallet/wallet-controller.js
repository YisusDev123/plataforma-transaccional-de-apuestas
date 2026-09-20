import { success } from "./../../shared/utils/response.js";
import { createPaginationMetadata } from "./../../shared/utils/pagination.js";

export function iniciarWalletController(servicioWallet, baseDeDatosWallet, settingsService, depositDestinationDatabase) {
    return {
        async getBalance(req, res, next) {
            try {
                const userId = req.userId;
                const balance = await servicioWallet.consultarBalance(baseDeDatosWallet, userId);
                return success(req, res, balance, 200);
            } catch (error) {
                next(error);
            }
        },

        async getTransactions(req, res, next) {
            try {
                const userId = req.userId;

                const { limit, offset, page } = req.pagination;

                const result = await servicioWallet.consultarTransacciones(baseDeDatosWallet, userId, limit, offset);

                const responseData = {
                    transacciones: result.transacciones,
                    pagination: createPaginationMetadata({ totalItems: result.total, page, limit })
                };

                return success(req, res, responseData, 200);
            } catch (error) {
            next(error);
            }
        },

        async getOperationRules(req, res, next) {
            try {
                const rules = await servicioWallet.consultarReglasOperativas(
                    settingsService, depositDestinationDatabase
                );
                return success(req, res, rules, 200);
            } catch (error) {
                next(error);
            }
        }
    };
}
