import { Router } from "express";
import { limitsContainer } from "../../container/limit-container.js";
import { requireRole } from "../../shared/middleware/admin-jwt.js";
import { validar } from "../../shared/middleware/joi-schema.js";
import { modificarLimiteSchema } from "../../schemas/limit-schema.js";
import { systemAvailability } from "../../container/setting-container.js";
import { superAdminOperationLimiter } from "../../shared/middleware/rate-limit.js";
const { limitsController, verifyAdmin } = limitsContainer;
const { maintenanceGuard } = systemAvailability;
const router = Router();


router.put("/max-amount", verifyAdmin, maintenanceGuard, superAdminOperationLimiter, requireRole("SUPER_ADMIN"), validar(modificarLimiteSchema), limitsController.modificarLimite);

export default router;
