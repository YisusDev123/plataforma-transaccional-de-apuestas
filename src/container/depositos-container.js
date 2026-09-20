import { pool } from "./../config/pool.js";
import { iniciarBaseDeDatosDeposits } from "../shared/database/deposits-sql.js";
import * as servicioDeposito from "./../modules/deposits/deposits-services.js";
import { iniciarDepositoController } from "../modules/deposits/deposits-controller.js";
import { iniciarAuthMiddleware } from "../shared/middleware/auth-middleware.js";
import { iniciarBaseDeDatos } from "./../shared/database/auth-SQL.js"

import { settingsService } from "./../container/setting-container.js";

const baseDeDatosDeposito = iniciarBaseDeDatosDeposits(pool);
const baseDeDatosUsers = iniciarBaseDeDatos(pool);
const controladorDeposito = iniciarDepositoController(servicioDeposito, baseDeDatosDeposito, baseDeDatosUsers, settingsService);
const authMiddleware = iniciarAuthMiddleware(baseDeDatosUsers);

export const contenedor = {
    controladorDeposito,
    authMiddleware
};
