import { pool } from "./../config/pool.js";
import { iniciarBaseDeDatosLimits } from "./../shared/database/limit-sql.js";
import * as limitsService from "./../modules/limits/limit-services.js";
import { iniciarLimitsController } from "./../modules/limits/limit-controller.js";
import { iniciarAuthMiddleware } from "./../shared/middleware/admin-jwt.js";
import { iniciarBaseDeDatos } from "./../shared/database/admin-sql.js"

const baseDeDatosAdmin = iniciarBaseDeDatos(pool)
const limitsSql = iniciarBaseDeDatosLimits(pool);
const limitsController = iniciarLimitsController(limitsService, limitsSql);
const verifyAdmin = iniciarAuthMiddleware(baseDeDatosAdmin)

export const limitsContainer = {
    limitsController,
    limitsSql,
    verifyAdmin
};
