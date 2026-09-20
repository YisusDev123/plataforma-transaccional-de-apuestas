export function iniciarBaseDeDatosDraw(pool) {
    return {
        async insertarSorteo(connection, adminId, payload, openAtUTC, closeAtUTC) {
            const { lottery, schedule_time, modality, draw_date } = payload;

            const query = `INSERT INTO draws (lottery, schedule_time, modality, draw_date, status, created_by_admin_id, open_at, close_at)
                VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)`;

            const [result] = await connection.query(query, [lottery, schedule_time, modality, draw_date, adminId, openAtUTC, closeAtUTC]);
            if(!result || !result.insertId) {
                const error = new Error("Error al insertar el sorteo en la base de datos.");
                error.statusCode = 500;
                throw error;
            }
            return result.insertId;
        },

        async getOpenDraws(lottery, scheduleTime) {
            const formattedTime = scheduleTime.length === 5 ? `${scheduleTime}:00` : scheduleTime;

            const nowCR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica" }));
            const yyyy = nowCR.getFullYear();
            const mm = String(nowCR.getMonth() + 1).padStart(2, '0');
            const dd = String(nowCR.getDate()).padStart(2, '0');
            const fechaCR = `${yyyy}-${mm}-${dd}`;

            const query = `SELECT id, modality FROM draws WHERE lottery = ? AND schedule_time = ? AND status IN ('OPEN', 'CLOSED') AND draw_date = ?`;

            const [rows] = await pool.query(query, [lottery, formattedTime, fechaCR]);
            return rows;
        },

        async listOpenDraws() {
            const query = `
                SELECT
                    d.id AS draw_id,
                    d.lottery,
                    d.modality,
                    d.draw_date,
                    d.schedule_time,
                    DATE_FORMAT(d.open_at, '%Y-%m-%dT%H:%i:%sZ') AS open_at,
                    DATE_FORMAT(d.close_at, '%Y-%m-%dT%H:%i:%sZ') AS close_at,
                    d.status,
                    pr.multiplier AS payout_multiplier,
                    pr.version AS payout_rule_version
                FROM draws d
                JOIN payout_rules pr
                  ON pr.lottery = d.lottery
                 AND pr.modality = d.modality
                 AND pr.is_active = 1
                WHERE d.status = 'OPEN'
                  AND d.open_at <= UTC_TIMESTAMP()
                  AND d.close_at > UTC_TIMESTAMP()
                  AND (
                      SELECT COUNT(DISTINCT nl.number_played)
                      FROM number_limits nl
                      WHERE nl.draw_id = d.id
                  ) = 100
                ORDER BY d.close_at ASC, d.lottery ASC, d.modality ASC
            `;
            const [rows] = await pool.query(query);
            return rows;
        },

        async getDrawAvailability(drawId) {
            const query = `
                SELECT
                    d.id AS draw_id,
                    d.lottery,
                    d.modality,
                    d.draw_date,
                    d.schedule_time,
                    DATE_FORMAT(d.open_at, '%Y-%m-%dT%H:%i:%sZ') AS open_at,
                    DATE_FORMAT(d.close_at, '%Y-%m-%dT%H:%i:%sZ') AS close_at,
                    d.status,
                    pr.multiplier AS payout_multiplier,
                    pr.version AS payout_rule_version,
                    nl.number_played,
                    CAST(
                        GREATEST(nl.max_amount - nl.current_amount, 0.00)
                        AS DECIMAL(18, 2)
                    ) AS remaining_amount,
                    CASE
                        WHEN nl.max_amount - nl.current_amount > 0 THEN 1
                        ELSE 0
                    END AS available
                FROM draws d
                JOIN number_limits nl ON nl.draw_id = d.id
                JOIN payout_rules pr
                  ON pr.lottery = d.lottery
                 AND pr.modality = d.modality
                 AND pr.is_active = 1
                WHERE d.id = ?
                  AND d.status = 'OPEN'
                  AND d.open_at <= UTC_TIMESTAMP()
                  AND d.close_at > UTC_TIMESTAMP()
                ORDER BY nl.number_played ASC
            `;
            const [rows] = await pool.query(query, [drawId]);
            return rows;
        },

        async listAdminDraws(status, limit, offset) {
            const dataQuery = `
                SELECT
                    d.id AS draw_id,
                    d.lottery,
                    d.modality,
                    d.draw_date,
                    d.schedule_time,
                    DATE_FORMAT(d.open_at, '%Y-%m-%dT%H:%i:%sZ') AS open_at,
                    DATE_FORMAT(d.close_at, '%Y-%m-%dT%H:%i:%sZ') AS close_at,
                    d.status,
                    d.result_number
                FROM draws d
                WHERE d.status = ?
                ORDER BY d.draw_date DESC, d.schedule_time DESC, d.id DESC
                LIMIT ? OFFSET ?
            `;
            const countQuery = `SELECT COUNT(*) AS total FROM draws WHERE status = ?`;
            const [[rows], [[countResult]]] = await Promise.all([
                pool.execute(dataQuery, [status, String(limit), String(offset)]),
                pool.execute(countQuery, [status])
            ]);
            return { rows, total: Number(countResult.total) };
        },

        async listAdminDrawList({ view, businessDate, dateFrom, dateTo, lottery, modality, status, limit, offset }) {
            const filters = [];
            const params = [];
            if (view === 'TODAY') {
                filters.push('d.draw_date = ?');
                params.push(businessDate);
            } else {
                filters.push('d.draw_date < ?');
                params.push(businessDate);
            }
            if (dateFrom) {
                filters.push('d.draw_date >= ?');
                params.push(dateFrom);
            }
            if (dateTo) {
                filters.push('d.draw_date <= ?');
                params.push(dateTo);
            }
            if (lottery) {
                filters.push('d.lottery = ?');
                params.push(lottery);
            }
            if (modality) {
                filters.push('d.modality = ?');
                params.push(modality);
            }
            if (status) {
                filters.push('d.status = ?');
                params.push(status);
            }

            const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
            const pageQuery = `
                SELECT d.id, d.lottery, d.modality, d.draw_date, d.schedule_time,
                       d.status, d.result_number,
                       dr.winning_number, dr.processed_status,
                       COALESCE(sold.total_sold, 0.00) AS total_sold,
                       COALESCE(dps.total_amount_paid, payout.actual_paid, 0.00) AS total_amount_paid,
                       COALESCE(refunds.total_refunded, 0.00) AS total_refunded
                FROM draws d
                LEFT JOIN draw_results dr ON dr.draw_id = d.id
                LEFT JOIN draw_payout_summaries dps ON dps.draw_id = d.id
                LEFT JOIN (
                    SELECT draw_id, COALESCE(SUM(amount), 0.00) AS total_sold
                    FROM bet_items
                    GROUP BY draw_id
                ) sold ON sold.draw_id = d.id
                LEFT JOIN (
                    SELECT bi.draw_id,
                           COALESCE(SUM(CASE WHEN wt.type = 'BET_WIN' AND wt.status = 'COMPLETED' THEN wt.amount ELSE 0 END), 0.00) AS actual_paid
                    FROM bet_items bi
                    LEFT JOIN wallet_transactions wt
                      ON wt.reference_type = 'bet_items'
                     AND wt.reference_id = bi.id
                    GROUP BY bi.draw_id
                ) payout ON payout.draw_id = d.id
                LEFT JOIN (
                    SELECT reference_id AS draw_id,
                           COALESCE(SUM(amount), 0.00) AS total_refunded
                    FROM wallet_transactions
                    WHERE reference_type = 'draw_cancellation'
                      AND type = 'REFUND'
                      AND status = 'COMPLETED'
                    GROUP BY reference_id
                ) refunds ON refunds.draw_id = d.id
                ${where}
                ORDER BY d.draw_date DESC, d.schedule_time DESC, d.id DESC
                LIMIT ? OFFSET ?`;
            const countQuery = `SELECT COUNT(*) AS total FROM draws d ${where}`;
            const pageParams = [...params, String(limit), String(offset)];
            const [drawResult, countResult] = await Promise.all([
                pool.execute(pageQuery, pageParams),
                pool.execute(countQuery, params)
            ]);
            const drawRows = drawResult[0];
            const total = Number(countResult[0][0]?.total || 0);
            if (drawRows.length === 0) return { draws: [], total };

            const drawIds = drawRows.map((draw) => draw.id);
            const placeholders = drawIds.map(() => '?').join(',');
            const numbersQuery = `
                WITH RECURSIVE number_catalog AS (
                    SELECT 0 AS number_value
                    UNION ALL
                    SELECT number_value + 1 FROM number_catalog WHERE number_value < 99
                )
                SELECT d.id AS draw_id,
                       LPAD(number_catalog.number_value, 2, '0') AS number_played,
                       CAST(COALESCE(nl.current_amount, SUM(bi.amount), 0.00) AS DECIMAL(18, 2)) AS sold_amount,
                       COUNT(bi.id) AS bet_count,
                       CAST(nl.max_amount AS DECIMAL(18, 2)) AS max_amount
                FROM draws d
                CROSS JOIN number_catalog
                LEFT JOIN number_limits nl
                  ON nl.draw_id = d.id
                 AND CAST(nl.number_played AS UNSIGNED) = number_catalog.number_value
                LEFT JOIN bet_items bi
                  ON bi.draw_id = d.id
                 AND CAST(bi.number_played AS UNSIGNED) = number_catalog.number_value
                WHERE d.id IN (${placeholders})
                GROUP BY d.id, number_catalog.number_value, nl.current_amount, nl.max_amount
                ORDER BY d.id, number_catalog.number_value`;
            const [numberRows] = await pool.execute(numbersQuery, drawIds);
            const numbersByDraw = new Map();
            for (const row of numberRows) {
                if (!numbersByDraw.has(row.draw_id)) numbersByDraw.set(row.draw_id, []);
                numbersByDraw.get(row.draw_id).push(row);
            }
            return {
                draws: drawRows.map((draw) => ({ ...draw, numbers: numbersByDraw.get(draw.id) || [] })),
                total
            };
        },

        async getAdminDrawLimits(drawId) {
            const query = `
                SELECT
                    d.id AS draw_id,
                    d.lottery,
                    d.modality,
                    d.draw_date,
                    d.schedule_time,
                    d.status,
                    nl.number_played,
                    CAST(nl.max_amount AS DECIMAL(18, 2)) AS max_amount,
                    CAST(nl.current_amount AS DECIMAL(18, 2)) AS current_amount,
                    CAST(GREATEST(nl.max_amount - nl.current_amount, 0.00) AS DECIMAL(18, 2)) AS remaining_amount
                FROM draws d
                JOIN number_limits nl ON nl.draw_id = d.id
                WHERE d.id = ?
                ORDER BY nl.number_played ASC
            `;
            const [rows] = await pool.query(query, [drawId]);
            return rows;
        },

            async saveResults(adminId, resultsToInsert, ip, device) {
                const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                const drawIds = resultsToInsert.map(r => r.draw_id);
                const placeholders = drawIds.map(() => '?').join(',');

                const checkQuery = `SELECT id, status FROM draws WHERE id IN (${placeholders}) FOR UPDATE`;
                const [draws] = await connection.query(checkQuery, drawIds);

                if (draws.length !== drawIds.length) {
                    const error = new Error("Uno o más sorteos proporcionados no existen en la base de datos.");
                    error.statusCode = 400;
                    throw error;
                }

                for (const draw of draws) {
                    if (draw.status !== 'CLOSED') {
                        const error = new Error(`El sorteo ID ${draw.id} no puede recibir resultados. Estado actual: '${draw.status}'. Solo se permiten sorteos en estado 'CLOSED'.`);
                        error.statusCode = 400;
                        throw error;
                    }
                }

                for (const result of resultsToInsert) {
                    const insertQuery = `INSERT INTO draw_results (draw_id, winning_number, processed_status, loaded_by_admin_id) VALUES (?, ?, 'PENDING', ?)`;
                    const [guardar] = await connection.query(insertQuery, [result.draw_id, result.winning_number, adminId]);
                    if(!guardar || !guardar.insertId) {
                        const error = new Error(`Error al guardar el resultado para el sorteo ID ${result.draw_id}.`);
                        error.statusCode = 500;
                        throw error;
                    }

                    const updateQuery = `UPDATE draws SET status = 'RESULT_LOADED', result_number = ? WHERE id = ?`;
                    const [guardarDraw] = await connection.query(updateQuery, [result.winning_number, result.draw_id]);
                    if(!guardarDraw || guardarDraw.affectedRows === 0) {
                        const error = new Error(`Error al actualizar el estado del sorteo ID ${result.draw_id}.`);
                        error.statusCode = 500;
                        throw error;
                    }

                    const auditPayload = JSON.stringify({
                        winning_number: result.winning_number,
                        device: device
                    });

                    const auditQuery = `
                        INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip)
                        VALUES (?, 'LOAD_DRAW_RESULT', 'DRAW_MANAGEMENT', ?, ?, ?)
                    `;
                    await connection.query(auditQuery, [adminId, result.draw_id, auditPayload, ip]);
                }

                await connection.commit();
                return true;

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        }
    };
}
