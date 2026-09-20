export function iniciarBaseDeDatosKyc(pool) {
    return {
        async procesarKycTransaccional(userId, fullName, dni) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const queryCheck = `SELECT id, kyc_status FROM user_kyc WHERE user_id = ? FOR UPDATE`;
                const [rows] = await connection.query(queryCheck, [userId]);

                if (rows.length > 0) {
                    const status = rows[0].kyc_status;
                    if (status === 'PENDING') {
                        const error = new Error("KYC_YA_EN_PROCESO")
                        error.statusCode = 404
                        throw error
                    }
                    if (status === 'APPROVED') {
                        const error = new Error("KYC_YA_APROBADO")
                        error.statusCode = 404
                        throw error
                    }

                    const query1 = `UPDATE user_kyc SET full_name = ?, dni = ?, kyc_status = 'PENDING', reviewed_by_admin_id = NULL, reviewed_at = NULL WHERE user_id = ?`
                    const [queryUpdateKyc] = await connection.query(query1, [fullName, dni, userId]);
                    if(queryUpdateKyc.affectedRows === 0){
                        const error = new Error("ERROR AL ACTUALIZAR DATOS DE KYC")
                        error.statusCode = 404
                        throw error
                    }

                } else {
                    const query2 = `INSERT INTO user_kyc (user_id, full_name, dni, kyc_status) VALUES (?, ?, ?, 'PENDING')`
                    const [queryInsertKyc] = await connection.query(query2, [userId, fullName, dni]);
                    if(queryInsertKyc.affectedRows === 0){
                        const error = new Error("ERROR AL INSERTAR DATOS KYC ENVIADOS")
                        error.statusCode = 404
                        throw error
                    }
                }

                const queryUser = `UPDATE users SET kyc_status = 'PENDING' WHERE id = ?`
                const [queryUpdateUser] = await connection.query(queryUser, [userId]);
                if(queryUpdateUser.affectedRows === 0){
                    const error = new Error("ERROR AL SINCRONIZAR ESTADO KYC DEL USUARIO")
                    error.statusCode = 500
                    throw error
                }

                await connection.commit();
                return {message: "DATOS ENVIADOS"};
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        }
    };
}
