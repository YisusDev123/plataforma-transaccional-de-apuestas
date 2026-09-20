import { success } from "./../../shared/utils/response.js";

export function iniciarKycController(servicioKyc, dbKyc, dbUsers) {
    return {
        async submitKyc(req, res, next) {
            try {
                const userId = req.userId;
                const { full_name, dni } = req.body;

                const resultado = await servicioKyc.enviarKyc(dbKyc, dbUsers, userId, full_name, dni);
                success(req, res, resultado, 201);
            } catch (error) {
                next(error);
            }
        }
    };
}
