import { Router } from "express";
import { contenedor } from "../../container/depositos-container.js";
import { validar } from "./../../shared/middleware/joi-schema.js"
import { createDepositSchema } from "../../schemas/deposits-schema.js";
import { depositLimiter } from "../../shared/middleware/rate-limit.js";
import { financialReadLimiter } from "../../shared/middleware/rate-limit.js";
import { depositHistoryQuerySchema, financialIdParamSchema } from "../../schemas/financial-history-schema.js";
import { extraerPaginacion } from "../../shared/middleware/paginacion.js";
const { controladorDeposito, authMiddleware } = contenedor

const router = Router();

router.post("/create", authMiddleware, depositLimiter, validar(createDepositSchema), controladorDeposito.create);
router.get("/", authMiddleware, financialReadLimiter, validar(depositHistoryQuerySchema, 'query'), extraerPaginacion, controladorDeposito.list);
router.get("/:id", authMiddleware, financialReadLimiter, validar(financialIdParamSchema, 'params'), controladorDeposito.detail);


export default router;
