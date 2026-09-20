import { success } from "../../shared/utils/response.js";
import { getRequestDevice } from "../../shared/utils/request-metadata.js";

export function iniciarLimitsController(limitsService, limitsSql) {
    return {
        async modificarLimite(req, res, next) {
            try {
                const adminId = req.admin.id
                const ip = req.ip;
                const device = getRequestDevice(req);

                const { draw_id, number_played, max_amount, remaining_amount, expected_max_amount } = req.body;

                const contenido = await limitsService.modificarMaxLimitesService(
                    limitsSql, adminId, ip, device, draw_id, number_played,
                    max_amount, expected_max_amount, remaining_amount
                );
                success(req, res, contenido, 200 )
            } catch (error) {
                next(error);
            }
        }
    };
}
