import { Router } from 'express';
import { payoutRuleContainer } from '../../container/payout-rule-container.js';
import { systemAvailability } from '../../container/setting-container.js';
import { requireRole } from '../../shared/middleware/admin-jwt.js';
import { validar } from '../../shared/middleware/joi-schema.js';
import { superAdminOperationLimiter, superAdminReadLimiter } from '../../shared/middleware/rate-limit.js';
import { payoutRuleParamSchema, updatePayoutRuleSchema } from '../../schemas/payout-rule-schema.js';

const router = Router();
const { payoutRuleController, verifyAdmin } = payoutRuleContainer;
const { maintenanceGuard } = systemAvailability;

router.get('/', verifyAdmin, maintenanceGuard, superAdminReadLimiter, requireRole('SUPER_ADMIN'), payoutRuleController.list);
router.patch('/:id', verifyAdmin, maintenanceGuard, superAdminOperationLimiter, requireRole('SUPER_ADMIN'), validar(payoutRuleParamSchema, 'params'), validar(updatePayoutRuleSchema), payoutRuleController.update);

export default router;
