export async function enviarKyc(dbKyc, dbUsers, userId, fullName, dni) {
    const usuario = await dbUsers.obtenerUsuarioPorId(userId)

    if (!usuario) {
        const error = new Error("USUARIO_NO_ENCONTRADO");
        error.statusCode = 404;
        throw error;
    }

    if (!usuario.email_verified) {
        const error = new Error("EMAIL_NO_VERIFICADO");
        error.statusCode = 403;
        throw error;
    }

    return await dbKyc.procesarKycTransaccional(userId, fullName, dni);
}
