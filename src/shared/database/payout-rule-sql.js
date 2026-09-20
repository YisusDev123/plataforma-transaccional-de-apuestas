export function iniciarPayoutRuleSql(pool) {
    return {
        async list() {
            const [rows] = await pool.query(`
                SELECT id, lottery, modality, multiplier, is_active, version,
                       DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updated_at
                FROM payout_rules
                ORDER BY lottery ASC, modality ASC
            `);
            return rows;
        },

        async update({ adminId, id, multiplier, expectedVersion, ip, device }) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                const [rows] = await connection.query(`
                    SELECT id, lottery, modality, multiplier, is_active, version
                    FROM payout_rules
                    WHERE id = ?
                    FOR UPDATE
                `, [id]);
                if (rows.length === 0) {
                    const error = new Error('La regla de premio no existe.');
                    error.statusCode = 404;
                    error.publicCode = 'PAYOUT_RULE_NOT_FOUND';
                    throw error;
                }

                const current = rows[0];
                if (Number(current.version) !== Number(expectedVersion)) {
                    const error = new Error('El multiplicador cambió mientras lo editabas. Actualiza la información e intenta nuevamente.');
                    error.statusCode = 409;
                    error.publicCode = 'PAYOUT_RULE_CHANGED';
                    throw error;
                }

                const nextMultiplier = Number(multiplier).toFixed(2);
                const [result] = await connection.query(`
                    UPDATE payout_rules
                    SET multiplier = ?, version = version + 1
                    WHERE id = ? AND version = ?
                `, [nextMultiplier, id, expectedVersion]);
                if (result.affectedRows !== 1) {
                    const error = new Error('El multiplicador cambió mientras lo editabas. Actualiza la información e intenta nuevamente.');
                    error.statusCode = 409;
                    error.publicCode = 'PAYOUT_RULE_CHANGED';
                    throw error;
                }

                const auditPayload = JSON.stringify({
                    lottery: current.lottery,
                    modality: current.modality,
                    previous_multiplier: Number(current.multiplier).toFixed(2),
                    new_multiplier: nextMultiplier,
                    previous_version: Number(current.version),
                    new_version: Number(current.version) + 1,
                    device
                });
                const [audit] = await connection.query(`
                    INSERT INTO audit_logs (admin_id, action, module_name, reference_id, payload, ip)
                    VALUES (?, 'UPDATE_PAYOUT_RULE', 'PAYOUT_RULE', ?, ?, ?)
                `, [adminId, id, auditPayload, ip]);
                if (audit.affectedRows !== 1) throw new Error('No se pudo registrar la auditoría del multiplicador.');

                await connection.commit();
                return {
                    ...current,
                    multiplier: nextMultiplier,
                    version: Number(current.version) + 1
                };
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        }
    };
}
