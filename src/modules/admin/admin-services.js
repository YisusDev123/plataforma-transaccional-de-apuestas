import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../../config.js';

export const login = async (baseDeDatos, email, password, ip, device) => {
    const admin = await baseDeDatos.buscarAdminPorEmail(email);
    const fakeHash = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    const passwordCorrecta = await bcrypt.compare(password, admin?.password_hash || fakeHash);
    if (!admin || !passwordCorrecta) {
        const error = new Error("CREDENCIALES INVALIDAS");
        error.statusCode = 401;
        throw error;
    }
    if (admin.status === "SUSPENDED") {
        const error = new Error("CUENTA SUSPENDIDA");
        error.statusCode = 403;
        throw error;
    }
    const generarToken = crypto.randomBytes(40).toString("hex");
    const convertirAHash = crypto.createHash("sha256").update(generarToken).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const nuevaSesionId = await baseDeDatos.registrarLoginCompleto(admin.id, convertirAHash, ip, device, expiresAt);

    const token = jwt.sign({
        adminId: admin.id,
        type: "admin",
        role: admin.role,
        sessionId: nuevaSesionId
    },
    config.security.jwtSecret,
    { expiresIn: "15m" });

    return {
        accessToken: token,
        token,
        refreshToken: generarToken,
        admin: { id: admin.id, email: admin.email, role: admin.role }
    };
};

export async function obtenerPerfilAdmin(baseDeDatos, adminId) {
    const admin = await baseDeDatos.obtenerAdminActivoPorId(adminId);
    if (!admin) {
        const error = new Error('ADMINISTRADOR NO ENCONTRADO O INACTIVO');
        error.statusCode = 404;
        throw error;
    }
    return { id: admin.id, email: admin.email, role: admin.role, status: admin.status };
}

export async function obtenerResumenOperativo(baseDeDatos, settingsService) {
    const summary = await baseDeDatos.obtenerResumenOperativo();
    const systemStatus = settingsService?.get("system_status");
    return {
        ...summary,
        system_status: systemStatus ? {
            maintenance_mode: systemStatus.maintenance_mode === true,
            sales_enabled: systemStatus.sales_enabled === true,
            message: String(systemStatus.message || '')
        } : null
    };
}

export async function obtenerDestinoDepositos(depositDestinationDatabase) {
    return { destinations: await depositDestinationDatabase.obtenerDestinosVigentes() };
}

export async function actualizarDestinoDepositos(depositDestinationDatabase, adminId, data, ip) {
    const destination = await depositDestinationDatabase.actualizarDestinoTransaccional(adminId, data, ip);
    return {
        message: 'DESTINO DE DEPÓSITOS ACTUALIZADO EXITOSAMENTE',
        destination
    };
}

export async function refrescarAdmin(baseDeDatos, refreshToken, ip, device) {
    if (!refreshToken) {
        const error = new Error('REFRESH TOKEN REQUERIDO');
        error.statusCode = 400;
        throw error;
    }
    const currentHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await baseDeDatos.buscarSesionAdminActivaPorHash(currentHash);
    if (!session) {
        const error = new Error('SESIÓN INVÁLIDA, REVOCADA O EXPIRADA');
        error.statusCode = 401;
        throw error;
    }
    const nextRefreshToken = crypto.randomBytes(40).toString('hex');
    const nextHash = crypto.createHash('sha256').update(nextRefreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const sessionId = await baseDeDatos.refrescarSesionAdminTransaccional(
        session.admin_id, currentHash, nextHash, ip, device, expiresAt
    );
    const accessToken = jwt.sign({
        adminId: session.admin_id,
        type: 'admin',
        role: session.role,
        sessionId
    }, config.security.jwtSecret, { expiresIn: '15m' });
    return { accessToken, refreshToken: nextRefreshToken };
}

export async function logoutAdmin(baseDeDatos, refreshToken) {
    if (refreshToken) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const session = await baseDeDatos.buscarSesionAdminActivaPorHash(tokenHash);
        if (session) await baseDeDatos.revocarSesionAdmin(session.id);
    }
    return { message: 'SESIÓN ADMINISTRATIVA CERRADA CORRECTAMENTE' };
}

export const crearNuevoAdmin = async (baseDeDatos, adminCreadorId, email, password, role, ip, device) => {

    if (role === "SUPER_ADMIN") {
        const error = new Error("OPERACIÓN DENEGADA: No se pueden crear cuentas con privilegios de SUPER_ADMIN");
        error.statusCode = 403;
        throw error;
    }

    const adminExistente = await baseDeDatos.existeEmailEnSistema(email);
    if (adminExistente) {
        const error = new Error("Este email ya esta registrado en el sistema");
        error.statusCode = 400;
        throw error;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const crearNuevo = await baseDeDatos.crearAdminTransaccional(adminCreadorId, email, passwordHash, role, ip, device);

    return {
        nuevoAdminId: crearNuevo, email, role
    };
};

export async function obtenerTodosLosAdmins(baseDeDatos) {

    const admins = await baseDeDatos.obtenerTodosLosAdmins();
    if (!admins || admins.length === 0) {
        const error = new Error("No se encontraron administradores en el sistema");
        error.statusCode = 404;
        throw error;
    }
    return {
        message: "ADMINISTRADORES OBTENIDOS EXITOSAMENTE",
        admins: admins
    }
}

export const procesarAprobacionDeposits = async (baseDeDatos, adminId, depositId, ip) => {
    await baseDeDatos.aprobarDepositoTransaccional(adminId, depositId, ip);
    return {
        message: "DEPÓSITO APROBADO EXITOSAMENTE",
        depositId: depositId
    }
};

export const procesarRechazoDeposito = async (baseDeDatos, adminId, depositId, ip, reason) => {
    const contenido =  await baseDeDatos.rechazarDepositoTransaccional(adminId, depositId, ip, reason);
    return {
        message: "DEPÓSITO RECHAZADO EXITOSAMENTE",
        deposit: contenido
    }
};

export const suspenderAdministrador = async (baseDeDatos, adminIdResponsable, adminIdObjetivo, ip) => {

    if (String(adminIdResponsable) === String(adminIdObjetivo)) {
        const error = new Error("OPERACIÓN DENEGADA: No puedes suspender tu propia cuenta");
        error.statusCode = 403;
        throw error;
    }

    await baseDeDatos.suspenderAdminTransaccional(adminIdResponsable, adminIdObjetivo, ip);
    return {
        message: "ADMINISTRADOR SUSPENDIDO EXITOSAMENTE",
        adminId: adminIdObjetivo
    }
};

export async function aprobarRetiro(baseDeDatos, withdrawalId, adminId, ip) {
    await baseDeDatos.aprobarRetiroTransaccional(withdrawalId, adminId, ip);
    return {
        message: "RETIRO APROBADO EXITOSAMENTE",
        withdrawalId: withdrawalId
    };
};

export async function rechazarRetiro(baseDeDatos, withdrawalId, adminId, ip, reason) {
    await baseDeDatos.rechazarRetiroTransaccional(withdrawalId, adminId, ip, reason)
    return {
        message: "RETIRO RECHAZADO EXITOSAMENTE",
        withdrawalId: withdrawalId
    }
};

export async function suspenderUsuario(baseDeDatos, targetUserId, reason, adminId, ip) {

    await baseDeDatos.ejecutarSuspensionTransaccional(targetUserId, reason, adminId, ip);
    return {
        userId: targetUserId,
        status: "SUSPENDED",
        reason: reason,
        message: "El usuario ha sido bloqueado y sus sesiones activas fueron revocadas."
    };
}

export async function procesarKycReview(baseDeDatos, id, adminId, status, detalles, ip) {
    const processKyc = await baseDeDatos.procesarKycReviewTransaccional(id, adminId, status, detalles, ip)
    return {
        userId: processKyc.userId,
        status: processKyc.status,
        message: "SOLICITUD KYC PROCESADA CORRECTAMENTE",

    }
}

export async function obtenerKycStatus(baseDeDatos, adminId, status, limit, offset) {
    const { rows, total } = await baseDeDatos.obtenerKycPorStatus(status, limit, offset);

    return {
        status: status,
        solicitudes: rows,
        total: total
    };
}

export async function obtenerDepositosStatus(baseDeDatos, adminId, status, limit, offset) {
    const { rows, total } = await baseDeDatos.obtenerDepositosPorStatus(status, limit, offset);

    return {
        status: status,
        deposits: rows,
        total: total
    };
}

export async function obtenerRetirosStatus(baseDeDatos, adminId, status, limit, offset) {
    const { rows, total } = await baseDeDatos.obtenerRetirosPorStatus(status, limit, offset);

    return {
        status: status,
        withdrawals: rows,
        total: total
    };
}

export async function reactivarAdmin(baseDeDatos, adminIdResponsable, adminIdObjetivo, ip) {
    await baseDeDatos.ejecutarReactivacionTransaccional(adminIdResponsable, adminIdObjetivo, ip);
    return {
        message: "ADMINISTRADOR REACTIVADO EXITOSAMENTE",
        adminId: adminIdObjetivo
    }
}

export async function ObtenerAllUsersKyc(baseDeDatos, limit, offset) {
    const { rows, total } = await baseDeDatos.obtenerTodosUsuariosConKyc(limit, offset);

    return {
        message: "USUARIOS OBTENIDOS EXITOSAMENTE",
        users: rows,
        total: total
    };
}

export async function reactivarUsuario(baseDeDatos, adminId, userId, ip) {
    await baseDeDatos.ejecutarReactivacionUsuarioTransaccional(adminId, userId, ip);
    return {
        message: "USUARIO REACTIVADO EXITOSAMENTE",
        userId: userId
    }
}
