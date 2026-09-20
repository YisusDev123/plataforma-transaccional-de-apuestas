import crypto from "crypto";

export function iniciarBaseDeDatosBet(pool, limitSql) {
    function idempotencyConflict(code, message) {
        const error = new Error(message);
        error.statusCode = 409;
        error.publicCode = code;
        return error;
    }

    async function recoverReplay(userId, requestId, requestedBets) {
        const [headers] = await pool.query(
            `SELECT id AS bet_id, user_id, ticket_code, total_amount FROM bets WHERE request_id = ? LIMIT 1`,
            [requestId]
        );
        if (headers.length === 0) return null;
        const header = headers[0];
        if (String(header.user_id) !== String(userId)) {
            throw idempotencyConflict('IDEMPOTENCY_KEY_CONFLICT', 'EL REQUEST ID YA ESTÁ EN USO');
        }
        const [storedItems] = await pool.query(
            `SELECT draw_id, number_played, amount FROM bet_items WHERE bet_id = ? ORDER BY draw_id, number_played`,
            [header.bet_id]
        );
        const normalize = items => items.map(item => ({
            drawId: String(item.draw_id), number: item.number_played, amount: Number(item.amount).toFixed(2)
        })).sort((a, b) => a.drawId.localeCompare(b.drawId) || a.number.localeCompare(b.number));
        if (JSON.stringify(normalize(storedItems)) !== JSON.stringify(normalize(requestedBets))) {
            throw idempotencyConflict('IDEMPOTENCY_PAYLOAD_MISMATCH', 'EL REQUEST ID FUE UTILIZADO CON UNA APUESTA DIFERENTE');
        }
        return header;
    }

    async function obtenerDatosComprobante(betId, userId = null) {
        const ownership = userId == null ? '' : 'AND b.user_id = ?';
        const params = userId == null ? [betId] : [betId, userId];
        const [headers] = await pool.query(`
            SELECT b.id, b.ticket_code, b.total_amount, b.created_at,
                   b.customer_name_snapshot
            FROM bets b
            WHERE b.id = ? ${ownership}
              AND b.customer_name_snapshot IS NOT NULL
            LIMIT 1
        `, params);
        if (headers.length === 0) return null;

        const [items] = await pool.query(`
            SELECT bi.draw_id, bi.number_played, bi.amount,
                   bi.payout_multiplier_snapshot, d.lottery, d.modality,
                   d.draw_date, d.schedule_time
            FROM bet_items bi
            JOIN draws d ON d.id = bi.draw_id
            WHERE bi.bet_id = ?
            ORDER BY bi.id
        `, [betId]);
        return { bet: headers[0], items };
    }

    return {
        recoverReplay,

        async processBetTransaction(userId, requestId, bets) {
            const totalCents = bets.reduce((acc, item) => {
                return acc + Math.round(Number(item.amount) * 100);
            }, 0);
            const totalStr = (totalCents / 100).toFixed(2);

            const connection = await pool.getConnection();

            try {
                await connection.beginTransaction();

                const [userRows] = await connection.query(
                    `SELECT u.status, u.kyc_status, k.full_name
                     FROM users u
                     LEFT JOIN user_kyc k ON k.user_id = u.id
                     WHERE u.id = ?
                     FOR UPDATE`,
                    [userId]
                );
                if (userRows.length === 0 || userRows[0].status !== 'ACTIVE') {
                    const error = new Error("LA CUENTA NO ESTÁ HABILITADA PARA APOSTAR");
                    error.statusCode = 403;
                    error.publicCode = "ACCOUNT_NOT_ELIGIBLE";
                    throw error;
                }
                if (userRows[0].kyc_status !== 'APPROVED') {
                    const error = new Error("DEBES VERIFICAR TU IDENTIDAD ANTES DE CONFIRMAR UNA APUESTA");
                    error.statusCode = 403;
                    error.publicCode = "KYC_REQUIRED";
                    throw error;
                }

                const drawIds = [...new Set(bets.map(b => b.draw_id))];
                const queryDrawOpen = `
                    SELECT id, lottery, modality, draw_date, schedule_time, status, close_at
                    FROM draws WHERE id IN (?)
                `;
                const [drawRows] = await connection.query(queryDrawOpen, [drawIds]);

                if (drawRows.length !== drawIds.length) {
                    const error = new Error("SORTEO NO DISPONIBLE");
                    error.statusCode = 400;
                    error.publicCode = "DRAW_UNAVAILABLE";
                    throw error;
                }

                const serverTime = new Date();
                for (const draw of drawRows) {
                    if (draw.status !== 'OPEN' || new Date(draw.close_at) <= serverTime) {
                        const error = new Error(`SORTEO CERRADO O NO DISPONIBLE: ${draw.id}`);
                        error.statusCode = 400;
                        error.publicCode = "DRAW_CLOSED";
                        throw error;
                    }
                }

                const drawsMap = Object.fromEntries(drawRows.map(draw => [draw.id, draw]));

                const riskByNumber = new Map();
                for (const item of bets) {
                    const key = `${item.draw_id}:${item.number_played}`;
                    const current = riskByNumber.get(key) || {
                        draw_id: item.draw_id,
                        number_played: item.number_played,
                        amountCents: 0
                    };
                    current.amountCents += Math.round(Number(item.amount) * 100);
                    riskByNumber.set(key, current);
                }

                const orderedRisks = [...riskByNumber.values()].sort((a, b) => {
                    return Number(a.draw_id) - Number(b.draw_id)
                        || String(a.number_played).localeCompare(String(b.number_played));
                });

                for (const item of orderedRisks) {
                    const limitData = await limitSql.obtenerYBloquearLimite(connection, item.draw_id, item.number_played);

                    if (!limitData) {
                        const error = new Error(`El número ${item.number_played} no está disponible en este sorteo.`);
                        error.statusCode = 400;
                        error.publicCode = "DRAW_OR_NUMBER_UNAVAILABLE";
                        throw error;
                    }

                    const currentAmount = Number(limitData.current_amount);
                    const incomingAmount = item.amountCents / 100;
                    const maxAmount = Number(limitData.max_amount);

                    if (currentAmount + incomingAmount > maxAmount) {
                        const error = new Error(`Límite excedido para el número ${item.number_played}. Disponible: ${maxAmount - currentAmount}`);
                        error.statusCode = 400;
                        error.publicCode = "NUMBER_LIMIT_EXCEEDED";
                        throw error;
                    }

                    await limitSql.aumentarMontoActual(connection, limitData.id, incomingAmount);
                }

                const rulePairs = [...new Map(drawRows.map(d => [
                    `${d.lottery}_${d.modality}`,
                    [d.lottery, d.modality]
                ])).values()].sort((left, right) => left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]));
                const rulePlaceholders = rulePairs.map(() => '(?, ?)').join(', ');
                const queryModality = `
                    SELECT lottery, modality, multiplier
                    FROM payout_rules
                    WHERE (lottery, modality) IN (${rulePlaceholders}) AND is_active = 1
                    ORDER BY lottery ASC, modality ASC
                    FOR SHARE
                `;
                const [ruleRows] = await connection.query(queryModality, rulePairs.flat());

                if (ruleRows.length !== rulePairs.length) {
                    const error = new Error("ERROR AL EXTRAER DATOS DE LA MODALIDAD");
                    error.statusCode = 400;
                    error.publicCode = "BET_MODALITY_UNAVAILABLE";
                    throw error;
                }

                const rulesMap = Object.fromEntries(
                    ruleRows.map(r => [`${r.lottery}_${r.modality}`, Number(r.multiplier).toFixed(2)])
                );

                const queryComprobarBalance = `SELECT id, available_balance FROM wallets WHERE user_id = ? FOR UPDATE`;
                const [walletRows] = await connection.query(queryComprobarBalance, [userId]);

                if (!walletRows.length || Number(walletRows[0].available_balance) < Number(totalStr)) {
                    const error = new Error("DINERO INSUFICIENTE EN BILLETERA");
                    error.statusCode = 400;
                    error.publicCode = "INSUFFICIENT_FUNDS";
                    throw error;
                }

                const walletId = walletRows[0].id;
                const balanceBefore = Number(walletRows[0].available_balance);
                const balanceAfter = (balanceBefore - Number(totalStr)).toFixed(2);

                const queryActualizarWallet = `UPDATE wallets SET available_balance = ? WHERE id = ?`;
                const [updateWallet] = await connection.query(queryActualizarWallet, [balanceAfter, walletId]);

                if (updateWallet.affectedRows === 0) {
                    const error = new Error("ERROR AL ACTUALIZAR WALLET");
                    error.statusCode = 400;
                    throw error;
                }

                const ticket_code = crypto.randomBytes(6).toString("hex").toUpperCase();
                const [[databaseClock]] = await connection.query(`
                    SELECT UTC_TIMESTAMP() AS created_at
                `);
                const queryInsertarBet = `
                    INSERT INTO bets (
                        user_id, ticket_code, total_amount, request_id,
                        customer_name_snapshot, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?)
                `;
                const [betResult] = await connection.query(queryInsertarBet, [
                    userId,
                    ticket_code,
                    totalStr,
                    requestId,
                    String(userRows[0].full_name).normalize('NFC'),
                    databaseClock.created_at
                ]);

                if (betResult.affectedRows === 0) {
                    const error = new Error("ERROR AL INSERTAR APUESTA");
                    error.statusCode = 400;
                    throw error;
                }
                const betId = betResult.insertId;

                const queryWalletTransac = `INSERT INTO wallet_transactions (wallet_id, type, amount, balance_before, balance_after, reference_type, reference_id, status) VALUES (?, 'BET', ?, ?, ?, 'bets', ?, 'COMPLETED')`;
                const [walletTrans] = await connection.query(queryWalletTransac, [walletId, `-${totalStr}`, balanceBefore.toFixed(2), balanceAfter, betId]);

                if (walletTrans.affectedRows === 0) {
                    const error = new Error("ERROR EN HISTORIAL DE TRANSACCIONES DE BILLETERA");
                    error.statusCode = 404;
                    throw error;
                }

                const itemsToInsert = bets.map(item => {
                    const draw = drawsMap[item.draw_id];
                    const activeMultiplier = rulesMap[`${draw.lottery}_${draw.modality}`];

                    if (!activeMultiplier) {
                        const error = new Error(`MODALIDAD DE APUESTA INACTIVA: ${draw.lottery} ${draw.modality}`);
                        error.statusCode = 404;
                        error.publicCode = "BET_MODALITY_UNAVAILABLE";
                        throw error;
                    }

                    return [betId, item.draw_id, item.number_played, String(item.amount), activeMultiplier, 'ACTIVE'];
                });

                const queryBetItems = `INSERT INTO bet_items (bet_id, draw_id, number_played, amount, payout_multiplier_snapshot, status) VALUES ?`;
                await connection.query(queryBetItems, [itemsToInsert]);

                await connection.commit();

                return { bet_id: betId, ticket_code, total_amount: totalStr };

            } catch (error) {
                await connection.rollback();

                if (error.code === 'ER_DUP_ENTRY') {
                    const existing = await recoverReplay(userId, requestId, bets);
                    if (existing) return existing;
                }
                throw error;
            } finally {
                connection.release();
            }
        },

        async listarApuestasUsuario(userId, filters, limit, offset) {
            const conditions = ['b.user_id = ?'];
            const params = [userId];
            if (filters.status) {
                conditions.push('b.status = ?');
                params.push(filters.status);
            }
            if (filters.requestId) {
                conditions.push('b.request_id = ?');
                params.push(filters.requestId);
            }
            if (filters.ticketCode) {
                conditions.push('b.ticket_code = ?');
                params.push(filters.ticketCode);
            }
            const where = conditions.join(' AND ');
            const [rows] = await pool.execute(`
                SELECT b.id, b.ticket_code, b.request_id, b.total_amount, b.status, b.created_at,
                       COUNT(bi.id) AS item_count,
                       COALESCE(SUM(CASE WHEN bi.status = 'WON' THEN COALESCE(p.amount, 0) ELSE 0 END), 0) AS total_payout,
                       COALESCE(SUM(CASE WHEN bi.status = 'CANCELLED' THEN bi.amount ELSE 0 END), 0) AS total_refunded
                FROM bets b
                LEFT JOIN bet_items bi ON bi.bet_id = b.id
                LEFT JOIN (
                    SELECT reference_id, SUM(amount) AS amount
                    FROM wallet_transactions
                    WHERE reference_type = 'bet_items' AND type = 'BET_WIN' AND status = 'COMPLETED'
                    GROUP BY reference_id
                ) p ON p.reference_id = bi.id
                WHERE ${where}
                GROUP BY b.id, b.ticket_code, b.request_id, b.total_amount, b.status, b.created_at
                ORDER BY b.created_at DESC, b.id DESC LIMIT ? OFFSET ?`, [...params, String(limit), String(offset)]);
            const [[count]] = await pool.execute(`SELECT COUNT(*) AS total FROM bets b WHERE ${where}`, params);
            return { rows, total: count.total };
        },

        async obtenerApuestaUsuario(userId, betId) {
            const [headers] = await pool.query(`
                SELECT id, ticket_code, request_id, total_amount, status, created_at,
                       customer_name_snapshot IS NOT NULL AS receipt_available
                FROM bets WHERE id = ? AND user_id = ? LIMIT 1`, [betId, userId]);
            if (headers.length === 0) return null;
            const [items] = await pool.query(`
                SELECT bi.id, bi.number_played, bi.amount, bi.payout_multiplier_snapshot,
                       bi.status, bi.payout_processed, d.id AS draw_id, d.lottery,
                       d.modality, d.draw_date, d.schedule_time, d.status AS draw_status,
                       d.result_number,
                       CAST(bi.amount * bi.payout_multiplier_snapshot AS DECIMAL(18,2)) AS potential_payout,
                       COALESCE(p.amount, 0) AS payout_amount
                FROM bet_items bi
                JOIN draws d ON d.id = bi.draw_id
                LEFT JOIN (
                    SELECT reference_id, SUM(amount) AS amount
                    FROM wallet_transactions
                    WHERE reference_type = 'bet_items' AND type = 'BET_WIN' AND status = 'COMPLETED'
                    GROUP BY reference_id
                ) p ON p.reference_id = bi.id
                WHERE bi.bet_id = ? ORDER BY bi.id`, [betId]);
            return { bet: headers[0], items };
        },

        async obtenerComprobanteUsuario(userId, betId) {
            return obtenerDatosComprobante(betId, userId);
        },

        async listarApuestasAdmin(filters, limit, offset) {
            const conditions = [];
            const params = [];
            if (filters.status) {
                conditions.push('b.status = ?');
                params.push(filters.status);
            }
            if (filters.ticketCode) {
                conditions.push('b.ticket_code = ?');
                params.push(filters.ticketCode);
            }
            if (filters.dateFrom) {
                conditions.push('b.created_at >= ?');
                params.push(`${filters.dateFrom} 00:00:00`);
            }
            if (filters.dateTo) {
                conditions.push('b.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
                params.push(`${filters.dateTo} 00:00:00`);
            }
            const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const [rows] = await pool.execute(`
                SELECT b.id, b.ticket_code, b.total_amount, b.status, b.created_at,
                       b.customer_name_snapshot AS customer_name,
                       b.customer_name_snapshot IS NOT NULL AS receipt_available,
                       COUNT(bi.id) AS item_count
                FROM bets b
                LEFT JOIN bet_items bi ON bi.bet_id = b.id
                ${where}
                GROUP BY b.id, b.ticket_code, b.total_amount, b.status, b.created_at,
                         customer_name, receipt_available
                ORDER BY b.created_at DESC, b.id DESC
                LIMIT ? OFFSET ?
            `, [...params, String(limit), String(offset)]);
            const [[count]] = await pool.execute(`SELECT COUNT(*) AS total FROM bets b ${where}`, params);
            return { rows, total: count.total };
        },

        async obtenerApuestaAdmin(betId) {
            const [headers] = await pool.query(`
                SELECT id, user_id, ticket_code, total_amount, status, created_at,
                       customer_name_snapshot AS customer_name,
                       customer_name_snapshot IS NOT NULL AS receipt_available
                FROM bets
                WHERE id = ?
                LIMIT 1
            `, [betId]);
            if (headers.length === 0) return null;
            const [items] = await pool.query(`
                SELECT bi.id, bi.number_played, bi.amount, bi.payout_multiplier_snapshot,
                       bi.status, bi.payout_processed, d.id AS draw_id, d.lottery,
                       d.modality, d.draw_date, d.schedule_time, d.status AS draw_status,
                       d.result_number,
                       CAST(bi.amount * bi.payout_multiplier_snapshot AS DECIMAL(18,2)) AS potential_payout,
                       COALESCE(p.amount, 0) AS payout_amount
                FROM bet_items bi
                JOIN draws d ON d.id = bi.draw_id
                LEFT JOIN (
                    SELECT reference_id, SUM(amount) AS amount
                    FROM wallet_transactions
                    WHERE reference_type = 'bet_items' AND type = 'BET_WIN' AND status = 'COMPLETED'
                    GROUP BY reference_id
                ) p ON p.reference_id = bi.id
                WHERE bi.bet_id = ?
                ORDER BY bi.id
            `, [betId]);
            return { bet: headers[0], items };
        },

        async obtenerComprobanteAdmin(betId) {
            return obtenerDatosComprobante(betId);
        }
    };
}
