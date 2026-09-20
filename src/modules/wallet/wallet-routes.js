import { Router } from "express";
import { contenedor } from "./../../container/wallet-container.js";
import { extraerPaginacion } from "../../shared/middleware/paginacion.js";
import { validar } from "../../shared/middleware/joi-schema.js";
import { walletLimiter } from "../../shared/middleware/rate-limit.js";
import { paginationQuerySchema } from "../../schemas/common-schema.js";
const { controladorWallet, authMiddleware } = contenedor

const router = Router();

router.get("/balance", authMiddleware, walletLimiter, controladorWallet.getBalance);
router.get("/operation-rules", authMiddleware, walletLimiter, controladorWallet.getOperationRules);
router.get("/transactions", authMiddleware, walletLimiter, validar(paginationQuerySchema, 'query'), extraerPaginacion, controladorWallet.getTransactions);

export default router;
