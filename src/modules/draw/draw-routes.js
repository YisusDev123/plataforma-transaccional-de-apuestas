import { Router } from "express";
import { contenedor } from "../../container/draw-container.js";
import { requireRole } from "../../shared/middleware/admin-jwt.js";
import { validar } from "./../../shared/middleware/joi-schema.js"
import { adminDrawListQuerySchema, adminDrawsQuerySchema, drawParamSchema, loadResultsSchema } from "../../schemas/draw-schema.js";
import { extraerPaginacion } from "../../shared/middleware/paginacion.js";
import { systemAvailability } from "../../container/setting-container.js";
import { adminFinancialReadLimiter, adminOperationLimiter, drawReadLimiter, superAdminOperationLimiter, superAdminReadLimiter } from "../../shared/middleware/rate-limit.js";

const { controladorDraw, verifyAdmin, authMiddleware } = contenedor;
const { maintenanceGuard } = systemAvailability;
const router = Router();

router.get("/open", authMiddleware, maintenanceGuard, drawReadLimiter, controladorDraw.listOpenDraws)
router.get("/admin", verifyAdmin, maintenanceGuard, adminOperationLimiter, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(adminDrawsQuerySchema, 'query'), extraerPaginacion, controladorDraw.listAdminDraws)
router.get("/admin/list", verifyAdmin, maintenanceGuard, adminFinancialReadLimiter, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(adminDrawListQuerySchema, 'query'), extraerPaginacion, controladorDraw.listAdminDrawList)
router.get("/admin/:id/limits", verifyAdmin, maintenanceGuard, superAdminReadLimiter, requireRole("SUPER_ADMIN"), validar(drawParamSchema, 'params'), controladorDraw.getAdminDrawLimits)
router.get("/:id/availability", authMiddleware, maintenanceGuard, drawReadLimiter, validar(drawParamSchema, 'params'), controladorDraw.getDrawAvailability)

router.post("/results", verifyAdmin, maintenanceGuard, adminOperationLimiter, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(loadResultsSchema), controladorDraw.loadResults)
router.patch("/:id/cancel", verifyAdmin, maintenanceGuard, superAdminOperationLimiter, requireRole("SUPER_ADMIN"), validar(drawParamSchema, 'params'), controladorDraw.cancelDraw)



export default router;
