import { success } from '../../shared/utils/response.js';
import { getRequestDevice } from '../../shared/utils/request-metadata.js';

export function iniciarPayoutRuleController(service) {
    return {
        async list(req, res, next) {
            try {
                success(req, res, { rules: await service.list() }, 200);
            } catch (error) {
                next(error);
            }
        },

        async update(req, res, next) {
            try {
                const result = await service.update({
                    adminId: req.admin.id,
                    id: req.validated.params.id,
                    multiplier: req.validated.body.multiplier,
                    expectedVersion: req.validated.body.expected_version,
                    ip: req.ip,
                    device: getRequestDevice(req)
                });
                success(req, res, {
                    message: 'Multiplicador actualizado correctamente.',
                    rule: result
                }, 200);
            } catch (error) {
                next(error);
            }
        }
    };
}
