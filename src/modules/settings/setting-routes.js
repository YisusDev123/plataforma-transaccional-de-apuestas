import { Router } from "express";
import { contenedor } from "../../container/setting-container.js";
import { requireRole } from "../../shared/middleware/admin-jwt.js";
import { validar, validarSettingsBody } from "../../shared/middleware/joi-schema.js";
import { settingsParamSchema } from "../../schemas/setting-schema.js";
import { superAdminOperationLimiter, superAdminReadLimiter } from "../../shared/middleware/rate-limit.js";


const { settingsController, verifyAdmin } = contenedor;
const router = Router();

router.patch("/:key", verifyAdmin, superAdminOperationLimiter, requireRole("SUPER_ADMIN"), validar(settingsParamSchema, 'params'), validarSettingsBody(), settingsController.updateConfig)
router.get("/", verifyAdmin, superAdminReadLimiter, requireRole("SUPER_ADMIN"), settingsController.getRules)


export default router;
