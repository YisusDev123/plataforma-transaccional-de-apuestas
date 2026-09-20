export function iniciarBaseDeDatosWithdrawals(pool) {
    function conflict(code, message) {
        const error = new Error(message);
        error.statusCode = 409;
        error.publicCode = code;
        return error;
    }

    function validateReplay(row, userId, amount, destinationAccount, destinationAccountHolder) {
        const snapshot = typeof row.withdrawal_account_snapshot === 'string'
            ? JSON.parse(row.withdrawal_account_snapshot) : row.withdrawal_account_snapshot;
        if (String(row.user_id) !== String(userId)) {
            throw conflict('IDEMPOTENCY_KEY_CONFLICT', 'EL REQUEST ID YA ESTÁ EN USO');
        }
        if (Number(row.amount) !== Number(amount)
            || snapshot?.cuenta !== destinationAccount
            || snapshot?.titular !== destinationAccountHolder) {
            throw conflict('IDEMPOTENCY_PAYLOAD_MISMATCH', 'EL REQUEST ID FUE UTILIZADO CON DATOS DIFERENTES');
        }
        return { id: row.id, status: row.status };
    }

    return {
        async crearRetiroTransaccional(userId, amountStr, destinationAccount, destinationAccountHolder, requestId) {

            const [existingRows] = await pool.query(
                `SELECT id, user_id, amount, withdrawal_account_snapshot, status FROM withdrawals WHERE request_id = ? LIMIT 1`,
                [requestId]
            );

            if (existingRows.length > 0) {
                return validateReplay(existingRows[0], userId, amountStr, destinationAccount, destinationAccountHolder);
            }

            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                const [walletRows] = await connection.query(
                    `SELECT id, available_balance FROM wallets WHERE user_id = ? FOR UPDATE`,
                    [userId]
                );

                if (!walletRows || walletRows.length === 0) {
                    const error = new Error("BILLETERA_NO_ENCONTRADA");
                    error.statusCode = 404;
                    throw error;
                }

                const wallet = walletRows[0];

                const queryUpdateWallet = `UPDATE wallets SET available_balance = available_balance - ?, held_balance = held_balance + ? WHERE id = ? AND available_balance >= ?`;
                const [actualizarWallet] = await connection.query(queryUpdateWallet, [amountStr, amountStr, wallet.id, amountStr]);

                if (actualizarWallet.affectedRows === 0) {
                    const error = new Error("FONDOS_INSUFICIENTES_PARA_EL_RETIRO");
                    error.statusCode = 400;
                    throw error;
                }

                const accountSnapshot = JSON.stringify({
                    cuenta: destinationAccount,
                    titular: destinationAccountHolder
                });

                const [withdrawalResult] = await connection.query(
                    `INSERT INTO withdrawals (user_id, amount, request_id, withdrawal_account_snapshot, status)
                    VALUES (?, ?, ?, ?, 'PENDING')`,
                    [userId, amountStr, requestId, accountSnapshot]
                );

                if (withdrawalResult.affectedRows === 0) {
                    throw new Error("ERROR_AL_GUARDAR_REGISTRO_DE_RETIRO");
                }

                const retiroId = withdrawalResult.insertId;

                const balanceBefore = Number(wallet.available_balance);
                const amountNum = Number(amountStr);
                const balanceAfter = balanceBefore - amountNum;

                const [transactionResult] = await connection.query(
                    `INSERT INTO wallet_transactions
                    (wallet_id, type, amount, balance_before, balance_after, reference_type, reference_id, status)
                    VALUES (?, 'WITHDRAWAL', ?, ?, ?, 'WITHDRAWAL', ?, 'PENDING')`,
                    [wallet.id, amountNum, balanceBefore, balanceAfter, retiroId]
                );

                if (transactionResult.affectedRows === 0) {
                    throw new Error("ERROR_AL_GUARDAR_TRANSACCION_DE_WALLET");
                }

                await connection.commit();
                return { id: retiroId, status: 'PENDING' };

            } catch (error) {
                await connection.rollback();

                if (error.code === 'ER_DUP_ENTRY') {
                    const [rows] = await connection.query(
                        `SELECT id, user_id, amount, withdrawal_account_snapshot, status FROM withdrawals WHERE request_id = ? LIMIT 1`,
                        [requestId]
                    );
                    if (rows && rows.length > 0) {
                        return validateReplay(rows[0], userId, amountStr, destinationAccount, destinationAccountHolder);
                    }
                }

                throw error;
            } finally {
                connection.release();
            }
        },

        async listarRetirosUsuario(userId, filters, limit, offset) {
            const conditions = ['user_id = ?'];
            const params = [userId];
            if (filters.status) {
                conditions.push('status = ?');
                params.push(filters.status);
            }
            if (filters.requestId) {
                conditions.push('request_id = ?');
                params.push(filters.requestId);
            }
            const where = conditions.join(' AND ');
            const [rows] = await pool.execute(`
                SELECT id, amount, request_id, withdrawal_account_snapshot, status,
                       rejection_reason, reviewed_at, processed_at, created_at
                FROM withdrawals WHERE ${where}
                ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, [...params, String(limit), String(offset)]);
            const [[count]] = await pool.execute(`SELECT COUNT(*) AS total FROM withdrawals WHERE ${where}`, params);
            return { rows, total: count.total };
        },

        async obtenerRetiroUsuario(userId, withdrawalId) {
            const [rows] = await pool.query(`
                SELECT id, amount, request_id, withdrawal_account_snapshot, status,
                       rejection_reason, reviewed_at, processed_at, created_at
                FROM withdrawals WHERE id = ? AND user_id = ? LIMIT 1`, [withdrawalId, userId]);
            return rows[0];
        }
    };
}
