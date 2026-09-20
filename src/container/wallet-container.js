import { pool } from "./../config/pool.js";
import { iniciarBaseDeDatosWallet } from "./../shared/database/wallet-sql.js";
import * as servicioWallet from "./../modules/wallet/wallet-services.js";
import { iniciarWalletController } from "./../modules/wallet/wallet-controller.js";
import { iniciarAuthMiddleware } from "./../shared/middleware/auth-middleware.js";
import { iniciarBaseDeDatos } from "./../shared/database/auth-SQL.js"
import { settingsService } from "./setting-container.js";
import { iniciarBaseDeDatosDepositDestination } from "../shared/database/deposit-destination-sql.js";


const baseDeDatosWallet = iniciarBaseDeDatosWallet(pool);
const baseDeDatosUsers = iniciarBaseDeDatos(pool);
const baseDeDatosDepositDestination = iniciarBaseDeDatosDepositDestination(pool);
const controladorWallet = iniciarWalletController(
    servicioWallet, baseDeDatosWallet, settingsService, baseDeDatosDepositDestination
);
const authMiddleware = iniciarAuthMiddleware(baseDeDatosUsers);

export const contenedor = {
    controladorWallet,
    authMiddleware,
};
