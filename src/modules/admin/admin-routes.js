import { Router } from "express";
import { contenedor } from "../../container/admin-container.js";
import { requireRole } from "../../shared/middleware/admin-jwt.js";
import { validar } from "./../../shared/middleware/joi-schema.js"
import { extraerPaginacion } from "../../shared/middleware/paginacion.js";
import { createAdminSchema, adminIdParamSchema, getDepositsQuerySchema,
depositIdParamSchema, rejectDepositBodySchema, rejectWithdrawalBodySchema, webAdminSessionSchema,
getWithdrawalsQuerySchema, withdrawalIdParamSchema, suspendUserBodySchema, userIdParamSchema,
adminLoginSchema, getUsersQuerySchema, listKycsQuerySchema, reviewKycBodySchema,
updateDepositDestinationSchema } from "../../schemas/admin-schemas.js";
import { systemAvailability } from "../../container/setting-container.js";
import {
    adminLoginAccountLimiter,
    adminLoginIpLimiter,
    adminOperationLimiter,
    superAdminOperationLimiter,
    superAdminReadLimiter
} from "../../shared/middleware/rate-limit.js";
import { requireTrustedOrigin } from "../../shared/middleware/trusted-origin.js";

const { controladorAdmin, verifyAdminToken } = contenedor;
const { maintenanceGuard } = systemAvailability;
const protectedAdmin = [verifyAdminToken, maintenanceGuard, adminOperationLimiter];
const protectedSuperAdmin = [verifyAdminToken, maintenanceGuard, superAdminOperationLimiter];
const protectedSuperAdminRead = [verifyAdminToken, maintenanceGuard, superAdminReadLimiter];
const router = Router();

router.post("/login", requireTrustedOrigin, validar(adminLoginSchema), adminLoginIpLimiter, adminLoginAccountLimiter, controladorAdmin.login);
router.post("/refresh", requireTrustedOrigin, validar(webAdminSessionSchema), controladorAdmin.refresh);
router.post("/logout", requireTrustedOrigin, validar(webAdminSessionSchema), controladorAdmin.logout);
router.get("/me", protectedAdmin, controladorAdmin.me);
router.get("/summary", protectedAdmin, requireRole("SUPER_ADMIN", "EMPLOYEE"), controladorAdmin.summary);

router.get('/deposit-destination', protectedSuperAdminRead, requireRole('SUPER_ADMIN'), controladorAdmin.obtenerDestinoDepositos);

router.put('/deposit-destination', protectedSuperAdmin, requireRole('SUPER_ADMIN'), validar(updateDepositDestinationSchema), controladorAdmin.actualizarDestinoDepositos);


router.post("/create", protectedSuperAdmin, requireRole('SUPER_ADMIN'), validar(createAdminSchema), controladorAdmin.crearAdmin);

router.get('/getAdmins', protectedSuperAdminRead, requireRole('SUPER_ADMIN'), controladorAdmin.listadoAdmins);

router.post("/:id/suspend-admin", protectedSuperAdmin, requireRole('SUPER_ADMIN'), validar(adminIdParamSchema, 'params'), controladorAdmin.suspenderAdmin);

router.patch("/:id/reactivate-Admin", protectedSuperAdmin, requireRole('SUPER_ADMIN'), validar(adminIdParamSchema, 'params'), controladorAdmin.reactivarAdmin);

router.get('/get-deposits', protectedAdmin, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(getDepositsQuerySchema, 'query'), extraerPaginacion, controladorAdmin.obtenerDepositos);

router.post("/:id/approve-deposits", protectedAdmin, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(depositIdParamSchema, 'params'), controladorAdmin.aprobarDepositos);

router.post("/:id/reject-deposits", protectedAdmin, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(depositIdParamSchema, 'params'), validar(rejectDepositBodySchema), controladorAdmin.rechazarDepositos);

router.get('/get-Withdrawals', protectedAdmin, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(getWithdrawalsQuerySchema, 'query'), extraerPaginacion, controladorAdmin.obtenerRetiros);

router.post("/:id/approve-withdrawals", protectedAdmin, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(withdrawalIdParamSchema, 'params'), controladorAdmin.aprobarRetiros);

router.post("/:id/reject-withdrawals", protectedAdmin, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(withdrawalIdParamSchema, 'params'), validar(rejectWithdrawalBodySchema), controladorAdmin.rechazarRetiros);

router.get('/getUsers', protectedAdmin, requireRole('SUPER_ADMIN', 'EMPLOYEE'), validar(getUsersQuerySchema, 'query'), extraerPaginacion, controladorAdmin.obtenerTodosLosUsuariosKyc);

router.patch("/users/suspend", protectedAdmin, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(suspendUserBodySchema), controladorAdmin.suspenderUsuario);

router.patch("/users/:id/user-Reactivate", protectedAdmin, requireRole('SUPER_ADMIN', 'EMPLOYEE'), validar(userIdParamSchema, 'params'), controladorAdmin.reactivarUsuario);

router.get('/kyc/request', protectedAdmin, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(listKycsQuerySchema, 'query'), extraerPaginacion, controladorAdmin.listarKycs);

router.patch('/kyc/review', protectedAdmin, requireRole("SUPER_ADMIN", "EMPLOYEE"), validar(reviewKycBodySchema), controladorAdmin.revisarKyc);




export default router;
