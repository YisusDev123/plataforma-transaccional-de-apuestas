import { pool } from "./../config/pool.js";
import { iniciarBaseDeDatosBet } from "./../shared/database/bet-sql.js";
import * as servicioBet from "./../modules/bets/bet-service.js";
import { iniciarBetController } from "./../modules/bets/bet-controller.js";
import { iniciarAuthMiddleware } from "./../shared/middleware/auth-middleware.js";
import { iniciarBaseDeDatos } from "./../shared/database/auth-SQL.js";
import { iniciarBaseDeDatosLimits } from "./../shared/database/limit-sql.js";

import { settingsService } from "./../container/setting-container.js";

const limitedSql = iniciarBaseDeDatosLimits(pool);
const betSql = iniciarBaseDeDatosBet(pool, limitedSql);
const baseDeDatosAuth = iniciarBaseDeDatos(pool);
const controladorBet = iniciarBetController(servicioBet, betSql, settingsService, limitedSql);
const authMiddleware = iniciarAuthMiddleware(baseDeDatosAuth);

export const contenedor = {
    controladorBet,
    authMiddleware
};
