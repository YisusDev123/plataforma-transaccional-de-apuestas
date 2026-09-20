export function iniciarBaseDeDatosJobs(pool) {
    return {
        async guardarOSobreescribirSorteo(connection, sorteo, defaultLimit) {
            const querySelect = `SELECT id, status FROM draws WHERE draw_date = ? AND lottery = ? AND schedule_time = ? AND modality = ?`;
            const [existentes] = await connection.execute(querySelect, [sorteo.draw_date, sorteo.lottery, sorteo.schedule_time, sorteo.modality]);

            if (existentes.length > 0) {
                console.log(`[JOBS] Sorteo ${sorteo.lottery} ${sorteo.schedule_time} ya existe. Ignorando.`);
                return;
            }

            const queryInsert = `INSERT INTO draws (lottery, schedule_time, modality, draw_date, status, open_at, close_at) VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`;
            const [insertResult] = await connection.execute(queryInsert, [
                sorteo.lottery, sorteo.schedule_time, sorteo.modality,
                sorteo.draw_date, sorteo.open_at, sorteo.close_at
            ]);

            const newDrawId = insertResult.insertId;

            const limitsData = [];
            for (let i = 0; i < 100; i++) {
                const numero = i.toString().padStart(2, '0');
                limitsData.push([newDrawId, numero, defaultLimit]);
            }

            const queryLimits = `INSERT INTO number_limits (draw_id, number_played, max_amount) VALUES ?`;
            await connection.query(queryLimits, [limitsData]);

            console.log(`[JOBS] Sorteo ID ${newDrawId} creado con su matriz completa de límites.`);
        },

        async escanearYActualizarEstados(fechaCR) {
            const queryOpen = `
                UPDATE draws d
                SET d.status = 'OPEN'
                WHERE d.status = 'PENDING'
                  AND d.open_at <= UTC_TIMESTAMP()
                  AND (
                      SELECT COUNT(*)
                      FROM number_limits nl
                      WHERE nl.draw_id = d.id
                  ) = 100`;
            const queryClose = `UPDATE draws SET status = 'CLOSED' WHERE status = 'OPEN' AND close_at <= UTC_TIMESTAMP()`;

                await pool.query(queryOpen);
                await pool.query(queryClose);

            const queryContar = `
                SELECT
                    COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as abiertosTotales,
                    COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as cerradosTotales
                FROM draws
                WHERE draw_date = ?
                `;

            const [rows] = await pool.query(queryContar, [fechaCR]);

            const queryIncompletos = `
                SELECT COUNT(*) AS total
                FROM draws d
                WHERE d.status = 'PENDING'
                  AND d.open_at <= UTC_TIMESTAMP()
                  AND (
                      SELECT COUNT(*)
                      FROM number_limits nl
                      WHERE nl.draw_id = d.id
                  ) <> 100`;
            const [[incompletos]] = await pool.query(queryIncompletos);

            return {
                abiertos: rows[0].abiertosTotales || 0,
                cerrados: rows[0].cerradosTotales || 0,
                incompletos: Number(incompletos.total) || 0
            };
            },

        async obtenerAlertasOperativas() {
            const [[incomplete]] = await pool.query(`
                SELECT COUNT(*) AS total
                FROM draws d
                WHERE d.status = 'PENDING'
                  AND d.open_at <= UTC_TIMESTAMP()
                  AND (SELECT COUNT(*) FROM number_limits nl WHERE nl.draw_id = d.id) <> 100
            `);
            const [[delayedPayouts]] = await pool.query(`
                SELECT COUNT(*) AS total
                FROM draw_results dr
                JOIN draws d ON d.id = dr.draw_id
                WHERE dr.processed_status IN ('PENDING', 'PROCESSING')
                  AND d.close_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)
            `);
            return {
                incompleteDraws: Number(incomplete.total) || 0,
                delayedPayouts: Number(delayedPayouts.total) || 0
            };
        },


    };
}
