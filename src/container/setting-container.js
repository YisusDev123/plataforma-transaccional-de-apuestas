import { pool } from "./../config/pool.js";
import { iniciarSettingsSql } from "./../shared/database/setting-sql.js";
import { iniciarSettingsService } from "./../modules/settings/setting-services.js";
import { iniciarSettingsController } from "./../modules/settings/setting-controller.js";

import { iniciarAuthMiddleware } from "./../shared/middleware/admin-jwt.js";
import { iniciarBaseDeDatos } from "./../shared/database/admin-sql.js";
import { iniciarSystemAvailabilityMiddleware } from "./../shared/middleware/system-availability.js";


const baseDeDatosAuth = iniciarBaseDeDatos(pool);
const verifyAdmin = iniciarAuthMiddleware(baseDeDatosAuth);

const settingsSql = iniciarSettingsSql(pool);
export const settingsService = iniciarSettingsService(settingsSql);
const settingsController = iniciarSettingsController(settingsService);
export const systemAvailability = iniciarSystemAvailabilityMiddleware(settingsService);

export const contenedor = {
    settingsController,
    settingsService,
    verifyAdmin,
    systemAvailability
}
