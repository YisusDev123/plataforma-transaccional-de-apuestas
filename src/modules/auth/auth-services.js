import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import crypto from "crypto"
import config from "../../../config.js"
import { generateAuthCode, hashAuthCode } from "../../shared/email/auth-code.js"
import { EmailDeliveryError } from "../../shared/email/email-provider.js"
import { logger } from "../../shared/error/winston.js"

const PASSWORD_RESET_RESPONSE = "SI EXISTE UNA CUENTA VÁLIDA, RECIBIRÁS UN CÓDIGO PARA RESTABLECER TU CONTRASEÑA"

function codeHash(purpose, email, code) {
    return hashAuthCode({ purpose, identity: email, code, secret: config.email.codeSecret })
}

async function deliverEmail(emailProvider, method, payload, { suppressError = false } = {}) {
    try {
        return await emailProvider[method](payload)
    } catch (error) {
        logger.warn('No fue posible entregar un correo de autenticación', {
            event: 'auth_email_delivery_failed',
            provider: emailProvider?.name || 'unknown',
            providerErrorCode: error?.code || 'EMAIL_PROVIDER_ERROR',
            emailType: method === 'sendVerificationCode' ? 'verification' : 'password_reset'
        })
        if (suppressError) return null
        throw error instanceof EmailDeliveryError ? error : new EmailDeliveryError()
    }
}

export async function registrarUsuario(baseDeDatos, emailProvider, email, password) {
    const usuarioExistente = await baseDeDatos.existeEmailEnSistema(email)
    if(usuarioExistente){
        const error = new Error("Este email ya esta registrado en el sistema")
        error.statusCode = 409
        throw error
    }
    const passwordHash = await bcrypt.hash(password, 10)
    const verificationCode = generateAuthCode()
    const verificationCodeHash = codeHash('email_verification', email, verificationCode)

    const registro = await baseDeDatos.registrarUsuarioTransaccional(email, passwordHash, verificationCodeHash)
    await deliverEmail(emailProvider, 'sendVerificationCode', {
        to: email,
        code: verificationCode,
        idempotencyKey: `email_verification_${registro.verificationId}`
    }, { suppressError: true })

    return {
        message: "USUARIO REGISTRADO EXITOSAMENTE, POR FAVOR VERIFIQUE SU CORREO"
    }
}

export async function crearVerificacionEmail(baseDeDatos, emailProvider, userId, email) {
    const verificationCode = generateAuthCode()
    const verificationCodeHash = codeHash('email_verification', email, verificationCode)
    const codigoCreado = await baseDeDatos.reemplazarCodigoVerificacionTransaccional(userId, verificationCodeHash)
    if(!codigoCreado){
        const error = new Error("ERROR AL GENERAR CODIGO DE VERIFICACION")
        error.statusCode = 400
        throw error
    }
    await deliverEmail(emailProvider, 'sendVerificationCode', {
        to: email,
        code: verificationCode,
        idempotencyKey: `email_verification_${codigoCreado}`
    })
    return {
        message: "CÓDIGO DE VERIFICACIÓN GENERADO Y ENVIADO A SU EMAIL"
    }
}

export async function verificarEmail(baseDeDatos, email, verificationCode) {
    const usuario = await baseDeDatos.buscarUsuarioPorEmail(email);

    if (!usuario) {
        const error = new Error("CÓDIGO O EMAIL INVÁLIDO");
        error.statusCode = 400;
        throw error;
    }

    if (usuario.email_verified) {
        return { message: "EMAIL VERIFICADO" };
    }

    const verificationCodeHash = codeHash('email_verification', email, verificationCode)
    await baseDeDatos.verificarEmailTransaccional(usuario.id, verificationCodeHash);
    return {
        message: "SU CUENTA HA SIDO VERIFICADA EXITOSAMENTE"
    };
}

export async function login(baseDeDatos, email, password, ip, device) {
    const usuario = await baseDeDatos.buscarUsuarioPorEmail(email);

    const fakeHash = "$2b$10$S3cur3F4k3H4shF0rT1m1ngAtt4cksPr3v3nt10n";
    const hashAComparar = usuario ? usuario.password_hash : fakeHash;

    const passwordCorrecta = await bcrypt.compare(password, hashAComparar);

    if (!usuario || !passwordCorrecta) {
        const error = new Error("CREDENCIALES INVALIDAS");
        error.statusCode = 401;
        throw error;
    }

    if (!usuario.email_verified) {
        const error = new Error("DEBE VERIFICAR SU CORREO PARA INICIAR SESIÓN");
        error.statusCode = 403;
        throw error;
    }

    if (usuario.status === 'SUSPENDED') {
        const error = new Error("Tu cuenta está suspendida. Por favor, contacta con soporte.");
        error.statusCode = 403;
        throw error;
    }

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const sesionCreadaId = await baseDeDatos.registrarLoginUsuarioTransaccional(usuario.id, refreshTokenHash, ip, device, expiresAt);

    const token = jwt.sign(
        { userId: usuario.id, sessionId: sesionCreadaId },
        config.security.jwtSecret,
        { expiresIn: "15m" }
    );

    return {
        accessToken: token,
        refreshToken: refreshToken,
        user: { id: usuario.id, email: usuario.email }
    };
}

export async function reenviarVerificacionEmail(baseDeDatos, emailProvider, email) {
    const usuario = await baseDeDatos.buscarUsuarioPorEmail(email)
    if(!usuario){
        const error = new Error("USUARIO NO EXISTE")
        error.statusCode = 404
        throw error
    }
    if(usuario.email_verified){
        const error = new Error("EL CORREO YA ESTA VERIFICADO")
        error.statusCode = 400
        throw error
    }

    await crearVerificacionEmail(baseDeDatos, emailProvider, usuario.id, email)
    return {
        message: "NUEVO CODIGO DE VERIFICACION ENVIADO"
    }
}

export async function olvideContraseña(baseDeDatos, emailProvider, email) {
    const usuario = await baseDeDatos.buscarUsuarioPorEmail(email)
    if (!usuario) {
        return { message: PASSWORD_RESET_RESPONSE }
    }
    const resetCode = generateAuthCode()
    const resetCodeHash = codeHash('password_reset', email, resetCode)
    const guardarCodigoReset = await baseDeDatos.reemplazarCodigoResetTransaccional(usuario.id, resetCodeHash)
    if(!guardarCodigoReset){
        const error = new Error("ERROR AL GENERAR CODIGO DE CAMBIO DE CONTRASEÑA")
        error.statusCode = 400
        throw error
    }
    await deliverEmail(emailProvider, 'sendPasswordResetCode', {
        to: email,
        code: resetCode,
        idempotencyKey: `password_reset_${guardarCodigoReset}`
    }, { suppressError: true })
    return {
        message: PASSWORD_RESET_RESPONSE
    }
}

export async function cambiarContraseña(baseDeDatos, email, resetCode, newPassword) {
    const usuario = await baseDeDatos.buscarUsuarioPorEmail(email)
    if (!usuario) {
        const error = new Error("USUARIO NO EXISTE")
        error.statusCode = 404
        throw error
    }

    const resetCodeHash = codeHash('password_reset', email, resetCode)
    const codigo = await baseDeDatos.buscarCodigoResetPassword(usuario.id, resetCodeHash)
    if (!codigo) {
        const error = new Error("CÓDIGO INVÁLIDO O YA UTILIZADO")
        error.statusCode = 400
        throw error
    }

    if (new Date(codigo.expires_at) < new Date()) {
        const error = new Error("CÓDIGO EXPIRADO")
        error.statusCode = 400
        throw error
    }
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await baseDeDatos.resetPasswordTransaccional(usuario.id, passwordHash, codigo.id)
    return {
        message: "CONTRASEÑA ACTUALIZADA EXITOSAMENTE Y SESIONES CERRADAS"
    }
}

export async function obtenerPerfil(baseDeDatos, userId) {
    const perfilDeUsuario = await baseDeDatos.obtenerUsuarioPorId(userId)
    if(!perfilDeUsuario){
        const error = new Error("NO SE PUDO OBTENER EL USUARIO")
        error.statusCode = 404
        throw error
    }
    return {
        id: perfilDeUsuario.id,
        email: perfilDeUsuario.email,
        emailVerified: Boolean(perfilDeUsuario.email_verified),
        status: perfilDeUsuario.status,
        kycStatus: perfilDeUsuario.kyc_status,
        fullName: perfilDeUsuario.full_name ?? null,
        dni: perfilDeUsuario.dni ?? null
    };

}

export async function refrescarToken(baseDeDatos, refreshToken, ip, device) {
    if (!refreshToken) {
        const error = new Error("REFRESH TOKEN REQUERIDO");
        error.statusCode = 400;
        throw error;
    }

    const tokenActual = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const sesion = await baseDeDatos.buscarSesionActivaPorHash(tokenActual);
    if (!sesion) {
        const error = new Error("SESIÓN INVÁLIDA, REVOCADA O EXPIRADA");
        error.statusCode = 401;
        throw error;
    }

    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newRefreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const newSessionId = await baseDeDatos.refrescarTokenTransaccional(sesion.user_id, tokenActual, newRefreshTokenHash, ip, device, expiresAt);

    const nuevoAccessToken = jwt.sign(
        { userId: sesion.user_id, sessionId: newSessionId },
        config.security.jwtSecret,
        { expiresIn: "15m" }
    );

    return {
        accessToken: nuevoAccessToken,
        refreshToken: newRefreshToken
    };
}

export async function logout(baseDeDatos, refreshToken) {
    if (!refreshToken) {
        return { message: "SESIÓN CERRADA CORRECTAMENTE" }
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const sesion = await baseDeDatos.buscarSesionActivaPorHash(tokenHash)

    if (sesion) {
        await baseDeDatos.revocarSesion(sesion.id)
    }

    return {
        message: "SESIÓN CERRADA CORRECTAMENTE"
    }
}
