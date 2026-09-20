import { pool } from "./../config/pool.js";
import { iniciarBaseDeDatosWithdrawals } from "./../shared/database/withdrawls-sql.js";
import * as servicioWithdrawals from "./../modules/withdrawls/withdrawls-service.js";
import { iniciarWithdrawalsController } from "./../modules/withdrawls/withdrawls-controller.js";
import { iniciarAuthMiddleware } from "./../shared/middleware/auth-middleware.js";
import { iniciarBaseDeDatos } from "./../shared/database/auth-SQL.js"

import { settingsService } from "./../container/setting-container.js";


const baseDeDatosWithdrawals = iniciarBaseDeDatosWithdrawals(pool);
const baseDeDatosUsers = iniciarBaseDeDatos(pool);
const controladorWithdrawals = iniciarWithdrawalsController(servicioWithdrawals, baseDeDatosWithdrawals, baseDeDatosUsers, settingsService);
const authMiddleware = iniciarAuthMiddleware(baseDeDatosUsers)

export const contenedor = {
    controladorWithdrawals,
    authMiddleware
};
