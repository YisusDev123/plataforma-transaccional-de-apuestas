import { pool } from "./../config/pool.js";
import { iniciarBaseDeDatosKyc } from "./../shared/database/kyc-sql.js";
import { iniciarBaseDeDatos } from "./../shared/database/auth-SQL.js";
import * as servicioKyc from "./../modules/kyc/kyc-services.js";
import { iniciarKycController } from "./../modules/kyc/kyc-controller.js";
import { iniciarAuthMiddleware } from "./../shared/middleware/auth-middleware.js";


const dbKyc = iniciarBaseDeDatosKyc(pool);
const dbUsers = iniciarBaseDeDatos(pool);


const controladorKyc = iniciarKycController(servicioKyc, dbKyc, dbUsers);
const authMiddleware = iniciarAuthMiddleware(dbUsers);

export const contenedor = {
    controladorKyc,
    authMiddleware,
};
