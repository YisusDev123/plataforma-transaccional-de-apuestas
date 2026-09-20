import { pool } from "./../config/pool.js"
import { iniciarBaseDeDatos } from "./../shared/database/auth-SQL.js"
import * as servicioAuth from "./../modules/auth/auth-services.js"
import { iniciarControlador } from "./../modules/auth/auth-controller.js"
import { iniciarAuthMiddleware } from "./../shared/middleware/auth-middleware.js";
import config from "../../config.js"
import { createEmailProvider } from "../shared/email/email-provider.js"


const baseDeDatos = iniciarBaseDeDatos(pool)
export const emailProvider = createEmailProvider(config.email)
const controladorAuth = iniciarControlador(servicioAuth, baseDeDatos, emailProvider)
const authMiddleware = iniciarAuthMiddleware(baseDeDatos)

export const contenedor = {
    controladorAuth,
    authMiddleware
}
