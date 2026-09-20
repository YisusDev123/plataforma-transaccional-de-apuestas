function mapDestination(row) {
    if (!row) return null;
    return {
        id: Number(row.id),
        type: row.type,
        destinationValue: row.destination_value,
        accountHolder: row.account_holder,
        version: Number(row.version),
        createdAt: row.created_at
    };
}

function maskedEnding(value) {
    const normalized = String(value || '').replace(/\s+/g, '');
    return normalized.slice(-4).padStart(Math.min(4, normalized.length), '*');
}

export function iniciarBaseDeDatosDepositDestination(pool) {
    return {
        async obtenerDestinosVigentes() {
            const [rows] = await pool.query(`
                SELECT d.id, d.type, d.destination_value, d.account_holder, d.version, d.created_at
                FROM deposit_destination_state s
                LEFT JOIN deposit_destinations d ON d.id = s.current_destination_id
                WHERE d.id IS NOT NULL
                ORDER BY FIELD(s.type, 'BANK_ACCOUNT', 'SINPE_MOVIL')
            `);
            return rows.map(mapDestination);
        },

        async actualizarDestinoTransaccional(adminId, data, ip) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                const [stateRows] = await connection.query(
                    'SELECT current_destination_id, version FROM deposit_destination_state WHERE type = ? FOR UPDATE',
                    [data.type]
                );
                const state = stateRows[0];
                if (!state) throw new Error('CONFIGURACIÓN DE DEPÓSITOS NO INICIALIZADA');

                const nextVersion = Number(state.version) + 1;
                const [inserted] = await connection.query(`
                    INSERT INTO deposit_destinations
                        (type, destination_value, account_holder, version, created_by_admin_id)
                    VALUES (?, ?, ?, ?, ?)
                `, [data.type, data.destinationValue, data.accountHolder, nextVersion, adminId]);
                if (!inserted.insertId) throw new Error('NO SE PUDO GUARDAR EL DESTINO DE DEPÓSITOS');

                await connection.query(`
                    UPDATE deposit_destination_state
                    SET current_destination_id = ?, version = ?, updated_at = UTC_TIMESTAMP()
                    WHERE type = ?
                `, [inserted.insertId, nextVersion, data.type]);

                const auditPayload = JSON.stringify({
                    previous_destination_id: state.current_destination_id || null,
                    destination_id: inserted.insertId,
                    type: data.type,
                    destination_ending: maskedEnding(data.destinationValue),
                    version: nextVersion
                });
                await connection.query(`
                    INSERT INTO audit_logs
                        (admin_id, action, module_name, reference_id, payload, ip)
                    VALUES (?, 'UPDATE_DESTINATION', 'DEPOSIT_DESTINATION', ?, ?, ?)
                `, [adminId, inserted.insertId, auditPayload, ip]);

                await connection.commit();
                return mapDestination({
                    id: inserted.insertId,
                    type: data.type,
                    destination_value: data.destinationValue,
                    account_holder: data.accountHolder,
                    version: nextVersion,
                    created_at: new Date()
                });
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        }
    };
}
