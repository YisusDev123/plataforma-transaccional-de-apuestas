export function iniciarSettingsSql(pool) {
    return {
        /**
         * Obtiene todos los registros para inicializar la caché en RAM.
         */
        async getAllSettings() {
            const [rows] = await pool.query(`SELECT setting_key, setting_value FROM settings`);
            return rows;
        },

        /**
         * Guarda o actualiza una configuración en la base de datos.
         */
        async updateSetting(key, valueString) {
            const query = `
                INSERT INTO settings (setting_key, setting_value)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            `;
            await pool.query(query, [key, valueString]);
            return true;
        },

        async updateDrawDefaultsConTransaccion(key, valueString, { availableAmount, closeMinutes }) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const [draws] = await connection.query(`
                    SELECT id, status
                    FROM draws
                    WHERE status IN ('PENDING', 'OPEN')
                    ORDER BY id
                    FOR UPDATE
                `);

                if (closeMinutes !== undefined && draws.some(draw => draw.status === 'OPEN')) {
                    const error = new Error("No se puede cambiar el cierre anticipado mientras exista un sorteo abierto.");
                    error.statusCode = 409;
                    error.publicCode = "OPEN_DRAWS_PREVENT_CLOSE_RULE_CHANGE";
                    throw error;
                }

                if (availableAmount !== undefined) {
                    await connection.query(`
                        SELECT nl.id
                        FROM number_limits nl
                        JOIN draws d ON nl.draw_id = d.id
                        WHERE d.status IN ('PENDING', 'OPEN')
                        ORDER BY nl.draw_id, nl.number_played
                        FOR UPDATE
                    `);
                    await connection.query(`
                        UPDATE number_limits nl
                        JOIN draws d ON nl.draw_id = d.id
                        SET nl.max_amount = nl.current_amount + ?
                        WHERE d.status IN ('PENDING', 'OPEN')
                    `, [availableAmount]);
                }

                if (closeMinutes !== undefined) {
                    await connection.query(`
                        UPDATE draws
                        SET close_at = DATE_SUB(
                            DATE_ADD(TIMESTAMP(draw_date, schedule_time), INTERVAL 6 HOUR),
                            INTERVAL ? MINUTE
                        )
                        WHERE status = 'PENDING'
                    `, [closeMinutes]);
                }

                const querySettings = `
                    INSERT INTO settings (setting_key, setting_value)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
                `;
                const [setting] = await connection.query(querySettings, [key, valueString]);
                if (setting.affectedRows === 0) {
                    const error = new Error("No se pudo actualizar la configuración.")
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
        }
    };
}
