import { Router } from "express";
import { contenedor } from "../../container/bet-container.js";
import { validar } from "./../../shared/middleware/joi-schema.js"
import { createBetSchema } from "../../schemas/bet-schema.js";
import { systemAvailability } from "../../container/setting-container.js";
import { betLimiter } from "../../shared/middleware/rate-limit.js";
import { financialReadLimiter } from "../../shared/middleware/rate-limit.js";
import { betHistoryQuerySchema, financialIdParamSchema } from "../../schemas/financial-history-schema.js";
import { extraerPaginacion } from "../../shared/middleware/paginacion.js";

const { controladorBet, authMiddleware } = contenedor;
const { salesGuard } = systemAvailability;
const router = Router();


router.post('/place', authMiddleware, salesGuard, betLimiter, validar(createBetSchema), controladorBet.createBet);
router.get('/history', authMiddleware, financialReadLimiter, validar(betHistoryQuerySchema, 'query'), extraerPaginacion, controladorBet.history);
router.get('/:id/receipt', authMiddleware, financialReadLimiter, validar(financialIdParamSchema, 'params'), controladorBet.receipt);
router.get('/:id', authMiddleware, financialReadLimiter, validar(financialIdParamSchema, 'params'), controladorBet.detail);

export default router;
