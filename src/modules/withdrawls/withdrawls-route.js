import { Router } from "express";
import { contenedor } from "../../container/withdrawls-container.js";
import { validar } from "../../shared/middleware/joi-schema.js";
import { requestWithdrawalSchema } from "../../schemas/withdrawls-schema.js";
import { withdrawalLimiter } from "../../shared/middleware/rate-limit.js";
import { financialReadLimiter } from "../../shared/middleware/rate-limit.js";
import { withdrawalHistoryQuerySchema, financialIdParamSchema } from "../../schemas/financial-history-schema.js";
import { extraerPaginacion } from "../../shared/middleware/paginacion.js";
const { controladorWithdrawals, authMiddleware  } = contenedor;
const router = Router();


router.post("/request", authMiddleware, withdrawalLimiter, validar(requestWithdrawalSchema), controladorWithdrawals.request);
router.get("/", authMiddleware, financialReadLimiter, validar(withdrawalHistoryQuerySchema, 'query'), extraerPaginacion, controladorWithdrawals.list);
router.get("/:id", authMiddleware, financialReadLimiter, validar(financialIdParamSchema, 'params'), controladorWithdrawals.detail);

export default router;
