import { pool } from "./../config/pool.js";
import { iniciarBaseDeDatos } from "./../shared/database/admin-sql.js";
import * as servicioAdmin from "./../modules/admin/admin-services.js";
import { iniciarAdminController } from "./../modules/admin/admin-controller.js";
import { iniciarAuthMiddleware } from "./../shared/middleware/admin-jwt.js";
import { settingsService } from "./setting-container.js";
import { iniciarBaseDeDatosDepositDestination } from "../shared/database/deposit-destination-sql.js";

const baseDeDatosAdmin = iniciarBaseDeDatos(pool);
const baseDeDatosDepositDestination = iniciarBaseDeDatosDepositDestination(pool);
const controladorAdmin = iniciarAdminController(
    servicioAdmin, baseDeDatosAdmin, settingsService, baseDeDatosDepositDestination
);


const verifyAdminToken = iniciarAuthMiddleware(baseDeDatosAdmin);

export const contenedor = {
    controladorAdmin,
    verifyAdminToken
};
