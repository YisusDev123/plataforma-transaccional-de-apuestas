import { Router } from 'express';
import { contenedor as betContainer } from '../../container/bet-container.js';
import { contenedor as adminContainer } from '../../container/admin-container.js';
import { systemAvailability } from '../../container/setting-container.js';
import { adminBetHistoryQuerySchema, financialIdParamSchema } from '../../schemas/financial-history-schema.js';
import { requireRole } from '../../shared/middleware/admin-jwt.js';
import { validar } from '../../shared/middleware/joi-schema.js';
import { extraerPaginacion } from '../../shared/middleware/paginacion.js';
import { adminFinancialReadLimiter } from '../../shared/middleware/rate-limit.js';

const router = Router();
const { controladorBet } = betContainer;
const { verifyAdminToken } = adminContainer;
const { maintenanceGuard } = systemAvailability;
const protectedRead = [
    verifyAdminToken,
    maintenanceGuard,
    adminFinancialReadLimiter,
    requireRole('SUPER_ADMIN', 'EMPLOYEE')
];

router.get('/', protectedRead, validar(adminBetHistoryQuerySchema, 'query'), extraerPaginacion, controladorBet.adminHistory);
router.get('/:id/receipt', protectedRead, validar(financialIdParamSchema, 'params'), controladorBet.adminReceipt);
router.get('/:id', protectedRead, validar(financialIdParamSchema, 'params'), controladorBet.adminDetail);

export default router;
