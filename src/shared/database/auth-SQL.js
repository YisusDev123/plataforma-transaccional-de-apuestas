
export function iniciarBaseDeDatos(pool){
    return {

        async existeEmailEnSistema(email) {
            const query = `SELECT 1 FROM ( SELECT email FROM users UNION ALL SELECT email FROM admins ) unir_tablas WHERE email = ? LIMIT 1`;
            const [rows] = await pool.query(query, [email]);
            return rows[0];
        },

        async buscarUsuarioPorEmail(email) {
        const query = `SELECT id, email, password_hash, email_verified, status FROM users WHERE email = ? LIMIT 1`
        const [rows] = await pool.query(query, [email])
        return rows[0]
        },

        async registrarLoginUsuarioTransaccional(userId, tokenHash, ip, device, expiresAt) {
            const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const queryInsert = `INSERT INTO user_sessions (user_id, refresh_token_hash, ip, device, expires_at) VALUES (?, ?, ?, ?, ?)`;
            const [resultadoInsert] = await connection.query(queryInsert, [userId, tokenHash, ip, device, expiresAt]);
            const sessionId = resultadoInsert.insertId;

        if (!sessionId) {
            const error = new Error("ERROR AL CREAR SESIÓN");
            error.statusCode = 500;
            throw error;
        }

            const queryRevocar = `UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND id != ? AND revoked_at IS NULL`;
            await connection.query(queryRevocar, [userId, sessionId]);

            await connection.commit();
            return sessionId;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        },

        async registrarUsuarioTransaccional(email, passwordHash, verificationCode) {
            const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const queryUser = `INSERT INTO users (email, password_hash) VALUES (?, ?)`;
            const [userResult] = await connection.query(queryUser, [email, passwordHash]);
        if(userResult.affectedRows === 0){
            const error = new Error("ERROR AL HACER REGISTRO DE USUARIO")
            error.statusCode = 500
            throw error
        }
            const userId = userResult.insertId;

            const queryWallet = `INSERT INTO wallets (user_id, available_balance, held_balance) VALUES (?, 0.00, 0.00)`;
            const [crearWallet] = await connection.query(queryWallet, [userId]);
        if(crearWallet.affectedRows === 0){
            const error = new Error("ERROR AL INTENTAR INICIARLIZAR LA WALLET DEL USUARIO REGISTRADO")
            error.statusCode = 500
            throw error
        }
            const queryCode = `INSERT INTO email_verifications (user_id, verification_code, status, expires_at) VALUES (?, ?, 'PENDING', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 60 MINUTE))`;
            const [insertar] = await connection.query(queryCode, [userId, verificationCode]);
        if(insertar.affectedRows === 0){
            const error = new Error("ERROR AL INSERTAR DATOS FINALES PARA FINALIZAR VERIFICACION")
            error.statusCode = 500
            throw error
        }
            await connection.commit();
            return { id: userId, email, verificationId: insertar.insertId };

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
            connection.release();
        }
        },

        async reemplazarCodigoVerificacionTransaccional(userId, verificationCodeHash) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                const [users] = await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
                if (users.length === 0) {
                    const error = new Error('USUARIO NO ENCONTRADO');
                    error.statusCode = 404;
                    throw error;
                }
                await connection.query(
                    `UPDATE email_verifications SET status = 'EXPIRED' WHERE user_id = ? AND status = 'PENDING'`,
                    [userId]
                );
                const [result] = await connection.query(
                    `INSERT INTO email_verifications(user_id, verification_code, status, expires_at) VALUES(?, ?, 'PENDING', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 60 MINUTE))`,
                    [userId, verificationCodeHash]
                );
                if (!result.insertId) throw new Error('ERROR AL GENERAR CÓDIGO DE VERIFICACIÓN');
                await connection.commit();
                return result.insertId;
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async obtenerUsuarioPorId(userId){
            const query = `
                SELECT u.id, u.email, u.email_verified, u.status,
                    COALESCE(k.kyc_status, u.kyc_status) AS kyc_status,
                    k.full_name, k.dni
                FROM users u
                LEFT JOIN user_kyc k ON k.user_id = u.id
                WHERE u.id = ?
            `
            const [resultado] = await pool.query(query, [userId])
            return resultado[0]
        },

        async buscarSesionActivaPorHash(tokenHash) {
            const query = `SELECT id, user_id, expires_at FROM user_sessions WHERE refresh_token_hash = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP() LIMIT 1`
            const [rows] = await pool.query(query, [tokenHash])
            return rows[0]
        },

        async revocarSesion(sessionId) {
            const query = `UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ?`
            const [resultado] = await pool.query(query, [sessionId])
            return resultado
        },

        async reemplazarCodigoResetTransaccional(userId, resetCodeHash) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                const [users] = await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
                if (users.length === 0) {
                    const error = new Error('USUARIO NO ENCONTRADO');
                    error.statusCode = 404;
                    throw error;
                }
                await connection.query(
                    `UPDATE password_resets SET status = 'EXPIRED' WHERE user_id = ? AND status = 'PENDING'`,
                    [userId]
                );
                const [result] = await connection.query(
                    `INSERT INTO password_resets (user_id, reset_code, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 60 MINUTE))`,
                    [userId, resetCodeHash]
                );
                if (!result.insertId) throw new Error('ERROR AL GENERAR CÓDIGO DE CAMBIO DE CONTRASEÑA');
                await connection.commit();
                return result.insertId;
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async buscarCodigoResetPassword(userId, resetCode) {
            const query = `SELECT id, user_id, reset_code, status, expires_at FROM password_resets WHERE user_id = ? AND reset_code = ? AND status = 'PENDING' LIMIT 1`
            const [rows] = await pool.query(query, [userId, resetCode])
            return rows[0]
        },

        async resetPasswordTransaccional(userId, passwordHash, codeId) {
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();
            const queryAtomicidad = `UPDATE password_resets SET status = 'USED', used_at = UTC_TIMESTAMP() WHERE id = ? AND user_id = ? AND status = 'PENDING' AND expires_at > UTC_TIMESTAMP()`
            const [resultadoCode] = await connection.query(queryAtomicidad, [codeId, userId]);
            if(resultadoCode.affectedRows === 0){
                const error = new Error("CONCURRENCIA: EL CÓDIGO YA FUE UTILIZADO");
                error.statusCode = 400
                throw error
            }

            const query1 = `UPDATE users SET password_hash = ? WHERE id = ?`
            const [actualizar] = await connection.query(query1, [passwordHash, userId])

            if (actualizar.affectedRows === 0) {
                const error = new Error("NO SE PUDO ACTUALIZAR LA CONTRASEÑA")
                error.statusCode = 500
                throw error
            }

            const query2 = `UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL`
            await connection.query(query2, [userId])

            await connection.commit()
        }catch(error){
            await connection.rollback()
            throw error
        }finally{
            connection.release()
        }
        },

        async verificarEmailTransaccional(userId, verificationCode) {
            const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const queryAtomicidad = `UPDATE email_verifications SET status = 'USED', used_at = UTC_TIMESTAMP() WHERE user_id = ? AND verification_code = ? AND status = 'PENDING' AND expires_at > UTC_TIMESTAMP()`;
            const [resultadoCode] = await connection.query(queryAtomicidad, [userId, verificationCode]);

        if (resultadoCode.affectedRows === 0) {
            const error = new Error("CÓDIGO INVÁLIDO, EXPIRADO O YA UTILIZADO");
            error.statusCode = 400;
            throw error;
        }

            const query1 = `UPDATE users SET email_verified = true WHERE id = ?`;
            const [marcarVerificado] = await connection.query(query1, [userId]);

        if (marcarVerificado.affectedRows === 0) {
            const error = new Error("ERROR AL MARCAR EMAIL COMO VERIFICADO");
            error.statusCode = 500;
            throw error;
        }

        await connection.commit();
        return true;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        },

        async refrescarTokenTransaccional(userId, tokenActual, newRefreshTokenHash, ip, device, expiresAt) {
            const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

        const queryAtomicidad = `UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP() WHERE refresh_token_hash = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()`;
        const [resultadoCode] = await connection.query(queryAtomicidad, [tokenActual, userId]);

        if (resultadoCode.affectedRows === 0) {
            const error = new Error("TOKEN IN VÁLIDO, EXPIRADO O YA UTILIZADO");
            error.statusCode = 401;
            throw error;
        }

        const queryInsert = `INSERT INTO user_sessions (user_id, refresh_token_hash, ip, device, expires_at) VALUES (?, ?, ?, ?, ?)`;
        const [resultadoInsert] = await connection.query(queryInsert, [userId, newRefreshTokenHash, ip, device, expiresAt]);

        if (resultadoInsert.affectedRows === 0) {
            const error = new Error("ERROR AL REGISTRAR LA NUEVA SESIÓN");
            error.statusCode = 500;
            throw error;
        }

        await connection.commit();
        return resultadoInsert.insertId;

        }catch (error) {
            await connection.rollback();
        throw error;
        } finally {
            connection.release();
        }
        },

        async buscarSesionActiva(sessionId) {
        const query = `
            SELECT s.id, s.user_id, s.expires_at
            FROM user_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.id = ?
              AND s.revoked_at IS NULL
              AND s.expires_at > UTC_TIMESTAMP()
              AND u.status = 'ACTIVE'
            LIMIT 1`;
        const [rows] = await pool.query(query, [sessionId]);
        return rows[0];
        },

        async obtenerKycStatus(userId) {
            const query = `SELECT kyc_status FROM users WHERE id = ? LIMIT 1`;
            const [rows] = await pool.query(query, [userId]);

            if (!rows || rows.length === 0) {
                const error = new Error("Usuario no encontrado.");
                error.statusCode = 404;
                throw error;
            }

            return rows[0].kyc_status;
        },

        async processKycReviewTransaccional(id, adminId, status, detalles, ip) {
            const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

        const [kycRows] = await connection.execute(
            'SELECT id, user_id, kyc_status FROM user_kyc WHERE id = ? FOR UPDATE',
            [id]
        );

        if (kycRows.length === 0) {
            const error = new Error("La solicitud de KYC especificada no existe.");
            error.statusCode = 404;
            throw error;
        }
        const kycRecord = kycRows[0];
        const userId = kycRecord.user_id;
        if (kycRecord.kyc_status !== 'PENDING') {
            const error = new Error("Esta solicitud de KYC ya fue procesada previamente.");
            error.statusCode = 400;
            throw error;
        }

        const userTableStatus = status;
        const queryKyc = `UPDATE user_kyc SET kyc_status = ?, reviewed_by_admin_id = ?, reviewed_at = NOW() WHERE id = ?`
        const [data] = await connection.execute(queryKyc, [status, adminId, id]);
        if(data.affectedRows === 0){
            const error = new Error("ERROR AL ACTUALIZAR EL ESTADO DE KYC")
            error.statusCode = 500
            throw error
        }

        const userQuery = `UPDATE users SET kyc_status = ? WHERE id = ?`
        const [userData] = await connection.execute(userQuery, [userTableStatus, userId]);
        if(userData.affectedRows === 0){
            const error = new Error("ERROR AL ACTUALIZAR EL ESTADO DE KYC EN LA TABLA DE USUARIOS")
            error.statusCode = 500
            throw error
        }

        const actionName = (status === 'APPROVED') ? 'APPROVE_KYC' : 'REJECT_KYC';
        const payload = JSON.stringify({ detalles });

        await connection.execute(
            `INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [adminId, actionName, 'KYC', id, payload, ip]
        );

        await connection.commit();

        return {
            status: status,
            userId: userId
        };

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
        },


}
}
