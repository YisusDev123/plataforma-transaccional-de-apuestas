import { pool } from "./../config/pool.js";
import { iniciarBaseDeDatosDraw } from "./../shared/database/draw-sql.js";
import * as drawService from "./../modules/draw/draw-service.js";
import { iniciarDrawController } from "./../modules/draw/draw-controller.js";
import { iniciarAuthMiddleware as iniciarAdminAuthMiddleware } from "./../shared/middleware/admin-jwt.js";
import { iniciarBaseDeDatos as iniciarBaseDeDatosAdmin } from "./../shared/database/admin-sql.js";
import { iniciarAuthMiddleware as iniciarUserAuthMiddleware } from "./../shared/middleware/auth-middleware.js";
import { iniciarBaseDeDatos as iniciarBaseDeDatosUsers } from "./../shared/database/auth-SQL.js";
import { iniciarCancelDrawSql } from "./../shared/database/cancel-draw-sql.js";
import { iniciarCancelDrawService } from "./../modules/draw/cancel-draw-service.js";
import { settingsService } from "./../container/setting-container.js";
import { limitsContainer } from "./limit-container.js";

import { eventBus } from './../shared/utils/events.js';


const cancelDrawSql = iniciarCancelDrawSql(pool);
const cancelDrawService = iniciarCancelDrawService(cancelDrawSql);
const drawSql = iniciarBaseDeDatosDraw(pool);
const baseDeDatosAdmin = iniciarBaseDeDatosAdmin(pool);
const baseDeDatosUsers = iniciarBaseDeDatosUsers(pool);


const controladorDraw = iniciarDrawController(drawService, pool, drawSql, limitsContainer.limitsSql, settingsService, cancelDrawService, eventBus);

const verifyAdmin = iniciarAdminAuthMiddleware(baseDeDatosAdmin);
const authMiddleware = iniciarUserAuthMiddleware(baseDeDatosUsers);

export const contenedor = {
    controladorDraw,
    verifyAdmin,
    authMiddleware
};
