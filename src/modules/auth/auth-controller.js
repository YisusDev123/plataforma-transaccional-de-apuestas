import { success } from "../../shared/utils/response.js"
import { getRequestDevice } from "../../shared/utils/request-metadata.js"
import {
    USER_REFRESH_COOKIE,
    clearRefreshCookie,
    readCookie,
    setRefreshCookie
} from "../../shared/utils/session-cookie.js";

export function iniciarControlador(servicio, baseDeDatos, emailProvider) {
    return {
            async registrarUsuario(req, res, next) {
                try{
                    const { email, password } = req.body
                    const contenido = await servicio.registrarUsuario(baseDeDatos, emailProvider, email, password)
                    success(req, res, contenido, 201)
                }catch(error){
                    next(error)
                }
            },
            async login(req, res, next){
                try{
                    const { email, password } = req.body
                    const ip = req.ip
                    const device = getRequestDevice(req)
                    const contenido = await servicio.login(baseDeDatos, email, password, ip, device)
                    const { refreshToken, ...publicContent } = contenido;
                    setRefreshCookie(res, USER_REFRESH_COOKIE, refreshToken, '/auth');
                    success(req, res, publicContent, 200)
                }catch(error){
                    next(error)
                }
            },
            async verificarEmail(req, res, next){
                try{
                    const { email, verificationCode } = req.body
                    const contenido = await servicio.verificarEmail(baseDeDatos, email, verificationCode)
                    success(req, res, contenido, 200)
                }catch(error){
                    next(error)
                }
            },

            async reenviarVerificacionEmail(req, res, next){
                try{
                    const { email } = req.body
                    const contenido = await servicio.reenviarVerificacionEmail(baseDeDatos, emailProvider, email)
                    success(req, res, contenido, 200)
                }catch(error){
                    next(error)
                }
            },

            async forgotPassword(req, res, next) {
                try {
                    const { email } = req.body
                    const contenido = await servicio.olvideContraseña(baseDeDatos, emailProvider, email)
                    success(req, res, contenido, 200)
                } catch (error) {
                    next(error)
                }
            },

            async resetPassword(req, res, next) {
                try {
                    const { email, resetCode, newPassword } = req.body
                    const contenido = await servicio.cambiarContraseña(baseDeDatos, email, resetCode, newPassword)
                    success(req, res, contenido, 200)
                } catch (error) {
                    next(error)
                }
            },

            async getMe(req, res, next){
                try{
                    const userId = req.userId
                    const contenido = await servicio.obtenerPerfil(baseDeDatos, userId)
                    success(req, res, contenido, 200)
                }catch(error){
                    next(error)
                }
            },

            async refresh(req, res, next) {
                try {
                    const refreshToken = readCookie(req, USER_REFRESH_COOKIE)
                    const ip = req.ip;
                    const device = getRequestDevice(req);
                    const contenido = await servicio.refrescarToken(baseDeDatos, refreshToken, ip, device)
                    const { refreshToken: nextRefreshToken, ...publicContent } = contenido;
                    setRefreshCookie(res, USER_REFRESH_COOKIE, nextRefreshToken, '/auth');
                    success(req, res, publicContent, 200)
                } catch (error) {
                    next(error)
                }
            },
            async logout(req, res, next){
                try{
                    const refreshToken = readCookie(req, USER_REFRESH_COOKIE)
                    const contenido = await servicio.logout(baseDeDatos, refreshToken)
                    clearRefreshCookie(res, USER_REFRESH_COOKIE, '/auth');
                    success(req, res, contenido, 200)
                }catch(error){
                    next(error)
                }
            }



}
}
