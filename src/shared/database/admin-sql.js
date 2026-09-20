export function iniciarBaseDeDatos(pool) {
    return {

        async obtenerResumenOperativo() {
            const [rows] = await pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM user_kyc WHERE kyc_status = 'PENDING') AS pending_kyc,
                    (SELECT COUNT(*) FROM deposits WHERE status = 'PENDING') AS pending_deposits,
                    (SELECT COUNT(*) FROM withdrawals WHERE status = 'PENDING') AS pending_withdrawals,
                    (SELECT COUNT(*) FROM draws WHERE status = 'CLOSED') AS closed_draws
            `);
            const summary = rows[0] || {};
            return {
                pending_kyc: Number(summary.pending_kyc || 0),
                pending_deposits: Number(summary.pending_deposits || 0),
                pending_withdrawals: Number(summary.pending_withdrawals || 0),
                closed_draws: Number(summary.closed_draws || 0)
            };
        },

        async existeEmailEnSistema(email) {
            const query = `SELECT 1 FROM ( SELECT email FROM users UNION ALL SELECT email FROM admins ) unir_tablas WHERE email = ? LIMIT 1`;
            const [rows] = await pool.query(query, [email]);
            return rows[0];
        },

        async buscarAdminPorEmail(email) {
            const query = 'SELECT id, email, password_hash, role, status FROM admins WHERE email = ? LIMIT 1';
            const [rows] = await pool.query(query, [email]);
            return rows[0];
        },

        async buscarSesionActiva(sessionId, adminId) {
            const query = `SELECT s.id, s.admin_id, a.email, a.role
                FROM admin_sessions s
                JOIN admins a ON a.id = s.admin_id
                WHERE s.id = ? AND s.admin_id = ? AND s.revoked_at IS NULL
                  AND s.expires_at > UTC_TIMESTAMP() AND a.status = 'ACTIVE'
                LIMIT 1`;
            const [rows] = await pool.query(query, [sessionId, adminId]);
            return rows[0];
        },

        async obtenerAdminActivoPorId(adminId) {
            const [rows] = await pool.query(
                `SELECT id, email, role, status FROM admins WHERE id = ? AND status = 'ACTIVE' LIMIT 1`,
                [adminId]
            );
            return rows[0];
        },

        async buscarSesionAdminActivaPorHash(tokenHash) {
            const [rows] = await pool.query(`
                SELECT s.id, s.admin_id, a.email, a.role
                FROM admin_sessions s
                JOIN admins a ON a.id = s.admin_id
                WHERE s.refresh_token_hash = ? AND s.revoked_at IS NULL
                  AND s.expires_at > UTC_TIMESTAMP() AND a.status = 'ACTIVE'
                LIMIT 1`, [tokenHash]);
            return rows[0];
        },

        async refrescarSesionAdminTransaccional(adminId, currentTokenHash, nextTokenHash, ip, device, expiresAt) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                const [revoked] = await connection.query(`
                    UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP()
                    WHERE admin_id = ? AND refresh_token_hash = ? AND revoked_at IS NULL
                      AND expires_at > UTC_TIMESTAMP()`, [adminId, currentTokenHash]);
                if (revoked.affectedRows !== 1) {
                    const error = new Error('SESIÓN INVÁLIDA, REVOCADA O EXPIRADA');
                    error.statusCode = 401;
                    throw error;
                }
                const [inserted] = await connection.query(`
                    INSERT INTO admin_sessions (admin_id, refresh_token_hash, ip, device, expires_at)
                    VALUES (?, ?, ?, ?, ?)`, [adminId, nextTokenHash, ip, device, expiresAt]);
                await connection.commit();
                return inserted.insertId;
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async revocarSesionAdmin(sessionId) {
            const [result] = await pool.query(
                `UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL`,
                [sessionId]
            );
            return result;
        },

        async registrarLoginCompleto(adminId, tokenHash, ip, device, expiresAt) {
            const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

        const queryS = 'INSERT INTO admin_sessions (admin_id, refresh_token_hash, ip, device, expires_at) VALUES (?, ?, ?, ?, ?)'
        const [nuevaSesion] = await connection.query(queryS, [adminId, tokenHash, ip, device, expiresAt]);
        const sessionId = nuevaSesion.insertId;

        if (!sessionId) {
            const error = new Error("ERROR AL REGISTRAR LA SESIÓN DE LOGIN");
            error.statusCode = 500;
            throw error;
        }

        const [revocarSesion] = await connection.query('UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP() WHERE admin_id = ? AND id != ? AND revoked_at IS NULL', [adminId, sessionId]);

        const payloadAudit = JSON.stringify({
            device,
            session_id: sessionId,
            sesiones_revocadas: revocarSesion.affectedRows
        });

        const Audit = 'INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip) VALUES (?, "LOGIN", "AUTH", ?, ?, ?)'
        const [auditar] = await connection.query(Audit, [adminId, sessionId, payloadAudit, ip]);

        if (auditar.affectedRows === 0) {
            const error = new Error("ERROR AL REGISTRAR LA AUDITORÍA DE LOGIN");
            error.statusCode = 500;
            throw error;
        }

        await connection.commit();
        return sessionId;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        },

        async aprobarDepositoTransaccional(adminId, depositoId, ip) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const queryDeposito = 'SELECT id, user_id, amount, status FROM deposits WHERE id = ? FOR UPDATE';
                const [depositoRows] = await connection.query(queryDeposito, [depositoId]);
                const deposito = depositoRows[0];

            if (!deposito) {
                const error = new Error("DEPOSITO NO ENCONTRADO");
                error.statusCode = 404;
                throw error;
            }
            if (deposito.status !== "PENDING") {
                const error = new Error("DEPOSITO YA FUE PROCESADO");
                error.statusCode = 409;
                throw error;
            }

            const queryWallet = 'SELECT id, available_balance FROM wallets WHERE user_id = ? FOR UPDATE';
            const [walletRows] = await connection.query(queryWallet, [deposito.user_id]);
            const wallet = walletRows[0];

            if (!wallet) {
                const error = new Error("WALLET NO ENCONTRADA");
                error.statusCode = 404;
                throw error;
            }

            const balanceAnterior = Number(wallet.available_balance);
            const montoDeposito = Number(deposito.amount);
            const balanceNuevo = balanceAnterior + montoDeposito;

            const queryActualizarWallet = 'UPDATE wallets SET available_balance = available_balance + ? WHERE id = ?';
            const [actualizarWallet] = await connection.query(queryActualizarWallet, [montoDeposito, wallet.id]);
            if (actualizarWallet.affectedRows === 0) {
                const error = new Error("ERROR AL ACTUALIZAR EL SALDO DE LA WALLET");
                error.statusCode = 500;
                throw error;
            }

            const queryInsertarTransaccion = `INSERT INTO wallet_transactions (wallet_id, type, amount, balance_before, balance_after, reference_type, reference_id, status) VALUES (?, 'DEPOSIT', ?, ?, ?, 'DEPOSIT', ?, 'COMPLETED')`;
            const [insertAudit] = await connection.query(queryInsertarTransaccion, [wallet.id, montoDeposito, balanceAnterior, balanceNuevo, deposito.id]);
            if(insertAudit.affectedRows === 0) {
                const error = new Error("ERROR AL REGISTRAR LA TRANSACCIÓN DE DEPÓSITO EN EL HISTORIAL DE LA WALLET");
                error.statusCode = 500;
                throw error;
            }

            const actualizarDeposito = `UPDATE deposits SET status = 'APPROVED', reviewed_by_admin_id = ?, reviewed_at = UTC_TIMESTAMP() WHERE id = ?`;
            const [actualizar] = await connection.query(actualizarDeposito, [adminId, deposito.id]);
            if(actualizar.affectedRows === 0) {
                const error = new Error("ERROR AL ACTUALIZAR EL ESTADO DEL DEPÓSITO A APROBADO");
                error.statusCode = 500;
                throw error;
            }

            const datosAuditoria = {
            deposit_id: deposito.id,
            usuario_afectado_id: deposito.user_id,
            monto: montoDeposito,
            balance_anterior: balanceAnterior,
            balance_nuevo: balanceNuevo,
            estado_anterior: "PENDING",
            estado_nuevo: "APPROVED"
        };

            const queryAudit = `INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip) VALUES (?, 'APPROVE', 'DEPOSITS', ?, ?, ?)`;
            const [auditar] = await connection.query(queryAudit, [adminId, deposito.id, JSON.stringify(datosAuditoria), ip]);
            if(auditar.affectedRows === 0) {
                const error = new Error("ERROR AL REGISTRAR LA AUDITORÍA DE APROBACIÓN DE DEPÓSITO");
                error.statusCode = 500;
                throw error;
            }

            await connection.commit();
            return {
                deposito_id: deposito.id,
                monto: montoDeposito, balanceNuevo
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
        connection.release();
        }
        },

        async rechazarRetiroTransaccional(withdrawalId, adminId, ip, motivoRechazo = "RECHAZADO POR EL ADMINISTRADOR") {
        const connection = await pool.getConnection();
        try {
        await connection.beginTransaction();

        const queryCheck = `SELECT id, user_id, amount, status FROM withdrawals WHERE id = ? FOR UPDATE`;
        const [rows] = await connection.query(queryCheck, [withdrawalId]);
        const retiro = rows[0];

        if (!retiro){
            const error = new Error("RETIRO NO ENCONTRADO");
            error.statusCode = 404;
            throw error;
        };
        if (retiro.status !== 'PENDING'){
            const error = new Error("ESTE RETIRO YA FUE PROCESADO");
            error.statusCode = 409;
            throw error;
        };

        const queryWallet = `SELECT id, available_balance, held_balance FROM wallets WHERE user_id = ? FOR UPDATE`;
        const [walletRows] = await connection.query(queryWallet, [retiro.user_id]);
        const wallet = walletRows[0];

        if (!wallet){
            const error = new Error("WALLET NO ENCONTRADA");
            error.statusCode = 404;
            throw error;
        };

        if (Number(wallet.held_balance) < Number(retiro.amount)) {
            const error = new Error("INTEGRIDAD CORRUMPIDA: EL SALDO RETENIDO ES MENOR AL MONTO A REEMBOLSAR");
            error.statusCode = 400;
            throw error;
        }

        const queryUpdateWithdrawal = `UPDATE withdrawals SET status = 'REJECTED', reviewed_by_admin_id = ?, reviewed_at = UTC_TIMESTAMP(), rejection_reason = ? WHERE id = ?`;
        const [actualizar] = await connection.query(queryUpdateWithdrawal, [adminId, motivoRechazo, withdrawalId]);
        if (actualizar.affectedRows === 0) {
            const error = new Error("ERROR AL ACTUALIZAR EL ESTADO DEL RETIRO A RECHAZADO");
            error.statusCode = 500;
            throw error;
        }

        const nuevoDisponible = Number(wallet.available_balance) + Number(retiro.amount);
        const queryUpdateWallet = `UPDATE wallets SET held_balance = held_balance - ?, available_balance = available_balance + ? WHERE id = ?`;
        const [actualizar1] = await connection.query(queryUpdateWallet, [retiro.amount, retiro.amount, wallet.id]);
        if (actualizar1.affectedRows === 0) {
            const error = new Error("ERROR AL ACTUALIZAR LA WALLET DURANTE EL RECHAZO DE RETIRO");
            error.statusCode = 500;
            throw error;
        }

        const queryInsertTrans = `INSERT INTO wallet_transactions (wallet_id, type, amount, balance_before, balance_after, reference_type, reference_id, status) VALUES (?, 'REFUND', ?, ?, ?, 'WITHDRAWAL', ?, 'COMPLETED')`;
        const [inserTr] = await connection.query(queryInsertTrans, [wallet.id, retiro.amount, wallet.available_balance, nuevoDisponible, withdrawalId]);
        if (inserTr.affectedRows === 0) {
            const error = new Error("ERROR AL REGISTRAR LA TRANSACCIÓN DE REEMBOLSO EN EL HISTORIAL DE LA WALLET");
            error.statusCode = 500;
            throw error;
        }

        const datosAuditoria = {
            withdrawal_id: retiro.id,
            usuario_afectado_id: retiro.user_id,
            monto_reembolsado: Number(retiro.amount),
            motivo: motivoRechazo,
            estado_anterior: "PENDING",
            estado_nuevo: "REJECTED"
        }

        const queryAudit = `INSERT INTO audit_logs(admin_id, action, module_name, reference_id, payload, ip) VALUES(?, 'REJECT_WITHDRAWAL', 'WITHDRAWALS', ?, ?, ?)`;
        const [auditoria] = await connection.query(queryAudit, [adminId, withdrawalId, JSON.stringify(datosAuditoria), ip]);
        if(auditoria.affectedRows === 0) {
            const error = new Error("ERROR AL REGISTRAR LA AUDITORÍA DE RECHAZO DE RETIRO");
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

        async suspenderAdminTransaccional(adminIdResponsable, adminIdObjetivo, ip) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const queryAdmin = 'SELECT id, status, role FROM admins WHERE id = ? FOR UPDATE';
                const [adminRows] = await connection.query(queryAdmin, [adminIdObjetivo]);
                const adminObjetivo = adminRows[0];

                if (!adminObjetivo) {
                    const error = new Error("ADMINISTRADOR NO ENCONTRADO");
                    error.statusCode = 404;
                    throw error;
                }
                if (adminObjetivo.role === "SUPER_ADMIN") {
                    const error = new Error("NO SE PUEDE SUSPENDER A UN SUPER_ADMIN");
                    error.statusCode = 403;
                    throw error;
                }
                if (adminObjetivo.status === "SUSPENDED") {
                    const error = new Error("EL ADMINISTRADOR YA ESTÁ SUSPENDIDO");
                    error.statusCode = 409;
                    throw error;
                }

                const actualizarAdmin = 'UPDATE admins SET status = "SUSPENDED" WHERE id = ?';
                const [actualizar] = await connection.query(actualizarAdmin, [adminObjetivo.id]);
                if (actualizar.affectedRows === 0) {
                    const error = new Error("ERROR AL CAMBIAR STATUS DE ADMIN A SUSPENDED");
                    error.statusCode = 500;
                    throw error;
                }

                const revocarSesiones = 'UPDATE admin_sessions SET revoked_at = UTC_TIMESTAMP() WHERE admin_id = ? AND revoked_at IS NULL';
                await connection.query(revocarSesiones, [adminObjetivo.id]);

                const datosAuditoria = {
                    admin_suspendido: adminObjetivo.id,
                    estado_anterior: "adminObjetivo.status",
                    estado_nuevo: "SUSPENDED"
                };

                const queryAudit = 'INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip) VALUES (?, "SUSPEND", "ADMINS", ?, ?, ?)';
                const [auditar] = await connection.query(queryAudit, [adminIdResponsable, adminObjetivo.id, JSON.stringify(datosAuditoria), ip]);
                if (auditar.affectedRows === 0) {
                    const error = new Error("ERROR AL REGISTRAR LA AUDITORÍA DE SUSPENSIÓN DE ADMIN");
                    error.statusCode = 500;
                    throw error;
                }

                await connection.commit();
                return { admin_suspendido: adminObjetivo.id };

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async crearAdminTransaccional(adminCreadorId, email, passwordHash, role, ip) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const queryInsertAdmin = `INSERT INTO admins (email, password_hash, role, status) VALUES (?, ?, ?, 'ACTIVE')`;
                const [resultadoAdmin] = await connection.query(queryInsertAdmin, [email, passwordHash, role]);
                const nuevoAdminId = resultadoAdmin.insertId;
                if (!nuevoAdminId) {
                    const error = new Error("ERROR AL CREAR EL NUEVO ADMINISTRADOR");
                    error.statusCode = 500;
                    throw error;
                }

                const datosAuditoria = {
                    nuevo_admin_id: nuevoAdminId,
                    email_asignado: email,
                    rol_asignado: role,
                    creado_por_admin_id: adminCreadorId
                };

                const queryAudit = `INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip) VALUES (?, 'CREATE', 'ADMINS', ?, ?, ?)`;
                const [auditar] = await connection.query(queryAudit, [adminCreadorId, nuevoAdminId, JSON.stringify(datosAuditoria), ip]);
                if (auditar.affectedRows === 0) {
                    const error = new Error("ERROR AL REGISTRAR LA AUDITORÍA DE CREACIÓN DE ADMIN");
                    error.statusCode = 500;
                    throw error;
                }

                await connection.commit();

                return nuevoAdminId;

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        },

        async aprobarRetiroTransaccional(withdrawalId, adminId, ip) {
        const connection = await pool.getConnection();
        try {
        await connection.beginTransaction();

        const queryCheck = `SELECT id, user_id, amount, status, withdrawal_account_snapshot FROM withdrawals WHERE id = ? FOR UPDATE`;
        const [rows] = await connection.query(queryCheck, [withdrawalId]);
        const retiro = rows[0];

        if (!retiro){
            const error = new Error("RETIRO NO ENCONTRADO");
            error.statusCode = 404;
            throw error;
        };
        if (retiro.status !== 'PENDING'){
            const error = new Error("ESTE RETIRO YA FUE PROCESADO");
            error.statusCode = 409;
            throw error;
        };

        const queryWallet = `SELECT id, held_balance FROM wallets WHERE user_id = ? FOR UPDATE`;
        const [walletRows] = await connection.query(queryWallet, [retiro.user_id]);
        const wallet = walletRows[0];

        if (!wallet){
            const error = new Error("WALLET NO ENCONTRADA");
            error.statusCode = 404;
            throw error;
        };

        if (Number(wallet.held_balance) < Number(retiro.amount)) {
            const error = new Error("INTEGRIDAD CORRUMPIDA: EL SALDO RETENIDO ES MENOR AL MONTO A DEBITAR");
            error.statusCode = 400;
            throw error;
        }

        const queryUpdateWithdrawal = `UPDATE withdrawals SET status = 'APPROVED', reviewed_by_admin_id = ?, reviewed_at = UTC_TIMESTAMP() WHERE id = ?`;
        const [actualizarEstado] = await connection.query(queryUpdateWithdrawal, [adminId, withdrawalId]);
        if (actualizarEstado.affectedRows === 0) {
            const error = new Error("ERROR AL ACTUALIZAR EL ESTADO DEL RETIRO A APROBADO");
            error.statusCode = 500;
            throw error;
        }


        const queryUpdateWallet = `UPDATE wallets SET held_balance = held_balance - ? WHERE id = ?`;
        const [actualizar1] = await connection.query(queryUpdateWallet, [retiro.amount, wallet.id]);
        if(actualizar1.affectedRows === 0) {
            const error = new Error("ERROR AL ACTUALIZAR EL MONTO DE RETIRO RETENIDO DEL USUARIO");
            error.statusCode = 500;
            throw error;
        }


        const queryUpdateTransaction = `UPDATE wallet_transactions SET status = 'COMPLETED' WHERE reference_type = 'WITHDRAWAL' AND reference_id = ?`;
        const [actualizar2] = await connection.query(queryUpdateTransaction, [withdrawalId]);
        if (actualizar2.affectedRows === 0) {
            const error = new Error("ERROR AL ACTUALIZAR EL ESTADO DE LA TRANSACCIÓN DE LA WALLET");
            error.statusCode = 500;
            throw error;
        }

        const datosAuditoria = {
            withdrawal_id: retiro.id,
            usuario_afectado_id: retiro.user_id,
            monto: Number(retiro.amount),
            destino: retiro.withdrawal_account_snapshot,
            estado_anterior: "PENDING",
            estado_nuevo: "APPROVED"
        };

        const queryAudit = `INSERT INTO audit_logs(admin_id, action, module_name, reference_id, payload, ip) VALUES(?, 'APPROVE_WITHDRAWAL', 'WITHDRAWALS', ?, ?, ?)`;
        const [auditar] = await connection.query(queryAudit, [adminId, retiro.id, JSON.stringify(datosAuditoria), ip]);
        if (auditar.affectedRows === 0) {
            const error = new Error("ERROR AL REGISTRAR LA AUDITORÍA DE APROBACIÓN DE RETIRO");
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

        async rechazarDepositoTransaccional(adminId, depositoId, ip, reason = "RECHAZADO POR EL ADMINISTRADOR") {
            const connection = await pool.getConnection();
        try {
        await connection.beginTransaction();

        const queryDeposito = 'SELECT id, user_id, amount, status FROM deposits WHERE id = ? FOR UPDATE';
        const [depositoRows] = await connection.query(queryDeposito, [depositoId]);
        const deposito = depositoRows[0];

        if (!deposito) {
            const error = new Error("DEPOSITO NO ENCONTRADO");
            error.statusCode = 404;
            throw error;
        }
        if (deposito.status !== "PENDING") {
            const error = new Error("DEPOSITO YA FUE PROCESADO");
            error.statusCode = 409;
            throw error;
        }

        const actualizarDeposito = `UPDATE deposits SET status = 'REJECTED', reviewed_by_admin_id = ?, reviewed_at = UTC_TIMESTAMP(), rejection_reason = ? WHERE id = ?`;
        const [actualizar] = await connection.query(actualizarDeposito, [adminId, reason, depositoId]);
        if (actualizar.affectedRows === 0) {
            const error = new Error("ERROR AL ACTUALIZAR EL ESTADO DEL DEPÓSITO A RECHAZADO");
            error.statusCode = 500;
            throw error;
        }

        const datosAuditoria = {
            deposit_id: deposito.id,
            usuario_afectado_id: deposito.user_id,
            monto: Number(deposito.amount),
            estado_anterior: "PENDING",
            estado_nuevo: "REJECTED",
            reason: reason };

        const queryAudit = `INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip) VALUES (?, 'REJECT', 'DEPOSITS', ?, ?, ?)`;
        const [auditoria] = await connection.query(queryAudit, [adminId, depositoId, JSON.stringify(datosAuditoria), ip]);
        if(auditoria.affectedRows === 0) {
            const error = new Error("ERROR AL REGISTRAR LA AUDITORÍA DE RECHAZO DE DEPÓSITO");
            error.statusCode = 500;
            throw error;
        }

        await connection.commit();
        return datosAuditoria;

        } catch (error) {
            await connection.rollback();
        throw error;
            } finally {
        connection.release();
        }
        },

        async ejecutarSuspensionTransaccional(targetUserId, reason, adminId, ip) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const queryUser = `SELECT id, status FROM users WHERE id = ? AND deleted_at IS NULL FOR UPDATE`;
                const [userRows] = await connection.query(queryUser, [targetUserId]);

                if (userRows.length === 0) {
                    const error = new Error("USUARIO A SUSPENDER NO ENCONTRADO O YA FUE ELIMINADO");
                    error.statusCode = 404;
                    throw error;
                }

                const estadoActual = userRows[0].status;

                if (estadoActual === 'SUSPENDED') {
                    const error = new Error("EL USUARIO YA SE ENCUENTRA SUSPENDIDO");
                    error.statusCode = 409;
                    error.publicCode = 'USER_ALREADY_SUSPENDED';
                    throw error;
                }

                if (estadoActual === 'BLOCKED') {
                    const error = new Error("OPERACIÓN INVÁLIDA: EL USUARIO YA ESTÁ BLOQUEADO PERMANENTEMENTE");
                    error.statusCode = 400;
                    throw error;
                }

                const querySuspend = `UPDATE users SET status = 'SUSPENDED' WHERE id = ?`;
                const [suspend] = await connection.query(querySuspend, [targetUserId]);

                if (suspend.affectedRows === 0) {
                    const error = new Error("ERROR AL SUSPENDER EL USUARIO");
                    error.statusCode = 500;
                    throw error;
                }

                const queryRevokeSessions = `UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL`;
                await connection.query(queryRevokeSessions, [targetUserId]);

                const queryAudit = `INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip) VALUES (?, ?, ?, ?, ?, ?)`;

                const metadataPayload = JSON.stringify({
                    reason: reason,
                    previous_status: estadoActual
                });

                const auditValues = [
                    adminId,
                    'SUSPEND_USER',
                    'ADMIN_MANAGEMENT',
                    targetUserId,
                    metadataPayload,
                    ip
                ];

                const [auditoria] = await connection.query(queryAudit, auditValues);
                if (auditoria.affectedRows === 0) {
                    const error = new Error("ERROR AL REGISTRAR LA AUDITORÍA DE SUSPENSIÓN DE USUARIO");
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

        async procesarKycReviewTransaccional(id, adminId, status, detalles, ip) {

            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

            const [kycRows] = await connection.execute(`SELECT user_id, kyc_status FROM user_kyc WHERE id = ? FOR UPDATE`, [id]);
            if (kycRows.length === 0) {
                const error = new Error("La solicitud de KYC no fue encontrada en el sistema.");
                error.statusCode = 404;
                throw error;
            }

            const { user_id: userId, kyc_status: currentStatus } = kycRows[0];

            if (currentStatus !== 'PENDING') {
            const error = new Error(`Esta solicitud ya no está pendiente. Estado actual: ${currentStatus}`);
            error.statusCode = 409;
            error.publicCode = 'KYC_ALREADY_REVIEWED';
            throw error;
            }

            const query0 = `UPDATE user_kyc SET kyc_status = ?, reviewed_by_admin_id = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`
            const [query1] = await connection.execute(query0, [status, adminId, id]);
            if(query1.affectedRows === 0) {
                const error = new Error("Error al actualizar el estado de la solicitud KYC.");
                error.statusCode = 500
                throw error
            }

            const queryKycUpdate = `UPDATE users SET kyc_status = ? WHERE id = ?`
            const [update] = await connection.execute(queryKycUpdate,[status, userId]);
            if(update.affectedRows === 0) {
                const error = new Error("Error al actualizar el estado global del usuario en la tabla users.");
                error.statusCode = 500
                throw error
            }


            const payloadData = JSON.stringify({
                kyc_id: id,
                user_id: userId,
                previous_status: 'PENDING',
                new_status: status,
                admin_notes: detalles
            });

            const queryAud = `INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip) VALUES (?, ?, ?, ?, ?, ?)`
            const [audit] = await connection.execute(queryAud, [adminId, 'REVIEW_KYC', 'ADMIN_KYC', id, payloadData, ip]);
            if(audit.affectedRows === 0) {
                const error = new Error("Error al registrar la auditoría de revisión KYC.");
                error.statusCode = 500
                throw error
            }

            await connection.commit();

            return {
                userId: userId,
                status: status
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        },

        async obtenerKycPorStatus(status, limit, offset) {
            const dataQuery = `
            SELECT id, user_id, full_name, dni, kyc_status, created_at
            FROM user_kyc
            WHERE kyc_status = ?
            ORDER BY created_at ASC
            LIMIT ? OFFSET ?
        `;

            const countQuery = `SELECT COUNT(*) AS total FROM user_kyc WHERE kyc_status = ?`;

            const [[rows], [[countResult]]] = await Promise.all([
                pool.execute(dataQuery, [status, limit.toString(), offset.toString()]),
                pool.execute(countQuery, [status])
            ]);

        return {
            rows,
            total: countResult.total
        };
        },

        async obtenerDepositosPorStatus(status, limit, offset) {
            const dataQuery = `
                SELECT d.id, d.user_id, d.reference_number, d.amount, d.status, d.created_at,
                u.email, k.full_name, k.dni,
                dd.id AS destination_id, dd.type AS destination_type,
                dd.destination_value, dd.account_holder, dd.version AS destination_version
                FROM deposits d
                LEFT JOIN users u ON d.user_id = u.id
                LEFT JOIN user_kyc k ON d.user_id = k.user_id
                LEFT JOIN deposit_destinations dd ON d.deposit_destination_id = dd.id
                WHERE d.status = ?
                ORDER BY d.created_at ASC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `SELECT COUNT(*) AS total FROM deposits WHERE status = ?`;

            const [[rows], [[countResult]]] = await Promise.all([
            pool.execute(dataQuery, [status, limit.toString(), offset.toString()]),
            pool.execute(countQuery, [status])
            ]);

        return {
            rows,
            total: countResult.total
        };
        },

        async obtenerRetirosPorStatus(status, limit, offset) {
            const dataQuery = `
                SELECT w.id AS withdrawal_id, w.user_id, w.amount, w.request_id,
                w.withdrawal_account_snapshot, w.status, w.created_at,
                u.email, k.full_name, k.dni
                FROM withdrawals w
                LEFT JOIN users u ON w.user_id = u.id
                LEFT JOIN user_kyc k ON w.user_id = k.user_id
                WHERE w.status = ?
                ORDER BY w.created_at ASC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `SELECT COUNT(*) AS total FROM withdrawals WHERE status = ?`;

            const [[rows], [[countResult]]] = await Promise.all([
                pool.execute(dataQuery, [status, limit.toString(), offset.toString()]),
                pool.execute(countQuery, [status])
            ]);

            return {
                rows,
                total: countResult.total
            };
        },

        async obtenerTodosLosAdmins() {
            const query = `SELECT id, email, role, status, created_at FROM admins ORDER BY created_at DESC`;
            const [rows] = await pool.execute(query);
            return rows;
        },

        async ejecutarReactivacionTransaccional(adminIdResponsable, adminIdObjetivo, ip) {
            const connection = await pool.getConnection();
            try {
            await connection.beginTransaction();

            const queryAdmin = 'SELECT id, status FROM admins WHERE id = ? FOR UPDATE';
            const [adminRows] = await connection.query(queryAdmin, [adminIdObjetivo]);

            if (adminRows.length === 0) {
                const error = new Error("ADMINISTRADOR NO ENCONTRADO");
                error.statusCode = 404;
                throw error;
            }

            const adminObjetivo = adminRows[0];

                if (adminObjetivo.status === 'ACTIVE') {
                const error = new Error("EL ADMINISTRADOR YA ESTÁ ACTIVO");
                error.statusCode = 400;
                throw error;
            }

            const actualizarAdmin = 'UPDATE admins SET status = "ACTIVE" WHERE id = ?';
            await connection.query(actualizarAdmin, [adminIdObjetivo]);

            const datosAuditoria = {
                admin_reactivado: adminIdObjetivo,
                estado_anterior: adminObjetivo.status,
                estado_nuevo: "ACTIVE"
            };

            const queryAudit = `INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip) VALUES (?, "REACTIVATE", "ADMINS", ?, ?, ?)`;

            await connection.query(queryAudit, [
                adminIdResponsable,
                adminIdObjetivo,
                JSON.stringify(datosAuditoria),
                ip
            ]);

            await connection.commit();
            return true;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        },

        async obtenerTodosUsuariosConKyc(limit, offset) {
            const dataQuery = `
                SELECT u.id, u.email, u.status, u.created_at, COALESCE(k.kyc_status, 'NO_KYC') AS kyc_status,
                CASE
                WHEN k.kyc_status = 'APPROVED' THEN k.full_name
                ELSE NULL
                END AS full_name,
                CASE
                WHEN k.kyc_status = 'APPROVED' THEN k.dni
                ELSE NULL
                END AS dni
                FROM users u
                LEFT JOIN user_kyc k ON u.id = k.user_id
                WHERE u.deleted_at IS NULL
                ORDER BY u.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL`;

            const [[rows], [[countResult]]] = await Promise.all([
                pool.execute(dataQuery, [limit.toString(), offset.toString()]),
                pool.execute(countQuery)
            ]);

            return {
                rows,
                total: countResult.total
            };
        },

        async ejecutarReactivacionUsuarioTransaccional(adminId, userId, ip) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

            const queryUser = 'SELECT id, status FROM users WHERE id = ? FOR UPDATE';
            const [userRows] = await connection.query(queryUser, [userId]);

            if (userRows.length === 0) {
                const error = new Error("USUARIO NO ENCONTRADO");
                error.statusCode = 404;
                throw error;
            }

            const user = userRows[0];

            if (user.status !== 'SUSPENDED') {
                const error = new Error(`Solo se pueden reactivar usuarios suspendidos. Estado actual: ${user.status}`);
                error.statusCode = 400;
                throw error;
            }

            const actualizarUser = 'UPDATE users SET status = "ACTIVE" WHERE id = ?';
            const [actu] = await connection.query(actualizarUser, [userId]);
            if (actu.affectedRows === 0) {
                const error = new Error("ERROR AL CAMBIAR STATUS DE USUARIO A ACTIVE");
                error.statusCode = 500;
                throw error;
            }

            const metadataPayload = JSON.stringify({
                previous_status: 'SUSPENDED',
                new_status: 'ACTIVE'
            });

            const queryAudit = `INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip)
                            VALUES (?, "REACTIVATE_USER", "USER_MANAGEMENT", ?, ?, ?)`;

            const [audit] = await connection.query(queryAudit, [
                adminId,
                userId,
                metadataPayload,
                ip
            ]);
            if (audit.affectedRows === 0) {
                const error = new Error("ERROR AL REGISTRAR LA AUDITORÍA DE REACTIVACIÓN DE USUARIO");
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

    }
}
