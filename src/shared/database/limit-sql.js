export function iniciarBaseDeDatosLimits(pool) {
    return {
        async inicializarLimitesSorteo(connection, drawId, defaultMaxAmount) {
            const db = connection || pool;
            const values = [];
            for (let i = 0; i < 100; i++) {
                const numberStr = String(i).padStart(2, "0");
                values.push([drawId, numberStr, defaultMaxAmount]);
            }
            const query = `INSERT INTO number_limits (draw_id, number_played, max_amount) VALUES ?`;
            await db.query(query, [values]);
        },

        async actualizarMaxAmount(adminId, ip, device, drawId, numberPlayed, maxAmount, expectedMaxAmount, requestedRemainingAmount) {
            const connection = await pool.getConnection();
                try {
                    await connection.beginTransaction();
                    const [drawRows] = await connection.query(
                        `SELECT id, status FROM draws WHERE id = ? FOR UPDATE`,
                        [drawId]
                    );
                    if (drawRows.length === 0) {
                        const error = new Error("Sorteo no encontrado.");
                        error.statusCode = 404;
                        throw error;
                    }
                    if (!['PENDING', 'OPEN'].includes(drawRows[0].status)) {
                        const error = new Error("Los límites sólo pueden modificarse antes del cierre del sorteo.");
                        error.statusCode = 409;
                        error.publicCode = "DRAW_NOT_EDITABLE";
                        throw error;
                    }
                    const [limitRows] = await connection.query(
                        `SELECT id, max_amount, current_amount
                         FROM number_limits
                         WHERE draw_id = ? AND number_played = ?
                         FOR UPDATE`,
                        [drawId, numberPlayed]
                    );
                    if (limitRows.length === 0) {
                        const error = new Error("La matriz de límites del sorteo está incompleta.");
                        error.statusCode = 503;
                        error.publicCode = "DRAW_LIMITS_INCOMPLETE";
                        throw error;
                    }

                    const moneyToCents = value => {
                        const [units, fraction = ''] = String(value).split('.');
                        return (BigInt(units) * 100n) + BigInt(`${fraction}00`.slice(0, 2));
                    };
                    const centsToMoney = value => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
                    const currentLimit = limitRows[0];
                    const previousMaxCents = moneyToCents(currentLimit.max_amount);
                    const currentCents = moneyToCents(currentLimit.current_amount);
                    const requestedRemainingCents = requestedRemainingAmount === undefined
                        ? undefined
                        : moneyToCents(requestedRemainingAmount);
                    const newMaxCents = requestedRemainingCents === undefined
                        ? moneyToCents(maxAmount)
                        : currentCents + requestedRemainingCents;
                    const previousMaxAmount = centsToMoney(previousMaxCents);
                    const currentAmount = centsToMoney(currentCents);
                    const newMaxAmount = centsToMoney(newMaxCents);

                    if (expectedMaxAmount !== undefined
                        && moneyToCents(expectedMaxAmount) !== previousMaxCents) {
                        const error = new Error("El límite cambió mientras lo editabas. Actualiza la información e intenta nuevamente.");
                        error.statusCode = 409;
                        error.publicCode = "LIMIT_CHANGED";
                        throw error;
                    }
                    if (newMaxCents < currentCents) {
                        const error = new Error("El nuevo límite no puede ser menor que el monto ya vendido.");
                        error.statusCode = 409;
                        error.publicCode = "LIMIT_BELOW_EXPOSURE";
                        throw error;
                    }

                    const [result] = await connection.query(
                        `UPDATE number_limits SET max_amount = ? WHERE id = ?`,
                        [newMaxAmount, currentLimit.id]
                    );
                    if (result.affectedRows === 0) {
                        const error = new Error("No se pudo actualizar el límite del número.");
                        error.statusCode = 500;
                        throw error;
                    }

                    const remainingAmount = centsToMoney(newMaxCents - currentCents);

            const datosAuditoria = {
                draw_id: drawId,
                number_played: numberPlayed,
                previous_max_amount: previousMaxAmount,
                new_max_amount: newMaxAmount,
                current_amount: currentAmount,
                remaining_amount: remainingAmount,
                requested_remaining_amount: requestedRemainingAmount === undefined
                    ? undefined
                    : centsToMoney(requestedRemainingCents),
                device: device
            };

            const queryAudit = `INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip) VALUES (?, 'NUMBER LIMIT', 'LIMIT', ?, ?, ?)`;
            const [auditar] = await connection.query(queryAudit, [
                adminId,
                drawId,
                JSON.stringify(datosAuditoria),
                ip
            ]);

            if (auditar.affectedRows === 0) {
                const error = new Error("ERROR AL REGISTRAR LA AUDITORÍA MODIFICACION DE LIMITE DE NUMERO");
                 error.statusCode = 500;
                throw error;
            }

            await connection.commit();
            return {
                previousMaxAmount,
                newMaxAmount,
                currentAmount,
                remainingAmount,
                requestedRemainingAmount: requestedRemainingAmount === undefined
                    ? undefined
                    : centsToMoney(requestedRemainingCents)
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        },

        async obtenerYBloquearLimite(connection, drawId, numberPlayed) {
            const query = `
                SELECT id, draw_id, number_played, max_amount, current_amount
                FROM number_limits
                WHERE draw_id = ? AND number_played = ?
                FOR UPDATE
            `;
            const [rows] = await connection.query(query, [drawId, numberPlayed]);
            return rows[0];
        },

        async obtenerLimiteDisponible(drawId, numberPlayed) {
            const query = 'SELECT max_amount, current_amount FROM number_limits WHERE draw_id = ? AND number_played = ?';
            const [rows] = await pool.query(query, [drawId, numberPlayed]);
            return rows.length > 0
                ? Math.max(0, Number(rows[0].max_amount) - Number(rows[0].current_amount))
                : null;
        },

        async aumentarMontoActual(connection, limitId, amount) {
            const query = `UPDATE number_limits SET current_amount = current_amount + ? WHERE id = ?`;
            await connection.query(query, [amount, limitId]);
        }
    };
}
