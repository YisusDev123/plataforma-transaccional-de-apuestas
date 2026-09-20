export function iniciarBaseDeDatosDeposits(pool){
    function conflict(code, message) {
        const error = new Error(message);
        error.statusCode = 409;
        error.publicCode = code;
        return error;
    }

    function validateReplay(row, userId, amount, referenceNumber, destinationId) {
        if (String(row.user_id) !== String(userId)) {
            throw conflict('IDEMPOTENCY_KEY_CONFLICT', 'EL REQUEST ID YA ESTÁ EN USO');
        }
        if (Number(row.amount) !== Number(amount) || row.reference_number !== referenceNumber
            || String(row.deposit_destination_id) !== String(destinationId)) {
            throw conflict('IDEMPOTENCY_PAYLOAD_MISMATCH', 'EL REQUEST ID FUE UTILIZADO CON DATOS DIFERENTES');
        }
        return { id: row.id, status: row.status };
    }

    return {
    async crearDepositoTransaccional(userId, amount, referenceNumber, requestId, destinationId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const queryCheck = `SELECT id, user_id, amount, reference_number, deposit_destination_id, status FROM deposits WHERE request_id = ? LIMIT 1`;
        const [rows] = await connection.query(queryCheck, [requestId]);

        if (rows.length > 0) {
            const replay = validateReplay(rows[0], userId, amount, referenceNumber, destinationId);
            await connection.commit();
            return replay;
        }

        const [referenceRows] = await connection.query(
            `SELECT id FROM deposits WHERE reference_number = ? LIMIT 1`, [referenceNumber]
        );
        if (referenceRows.length > 0) {
            throw conflict('REFERENCE_ALREADY_USED', 'EL NÚMERO DE REFERENCIA YA FUE UTILIZADO');
        }

        const [destinationRows] = await connection.query(`
            SELECT id FROM deposit_destinations WHERE id = ? LIMIT 1
        `, [destinationId]);
        const selectedDestination = destinationRows[0];
        if (!selectedDestination) {
            const error = new Error('LOS DEPÓSITOS NO ESTÁN DISPONIBLES TEMPORALMENTE');
            error.statusCode = 503;
            error.publicCode = 'DEPOSIT_DESTINATION_UNAVAILABLE';
            throw error;
        }

        const queryInsert = `INSERT INTO deposits (user_id, amount, reference_number, request_id, deposit_destination_id, status) VALUES (?, ?, ?, ?, ?, 'PENDING')`;
        const [resultado] = await connection.query(queryInsert, [
            userId, amount, referenceNumber, requestId, selectedDestination.id
        ]);

        if (resultado.affectedRows === 0) {
            const error = new Error("ERROR AL REGISTRAR LOS DATOS DEL DEPÓSITO");
            error.statusCode = 500;
            throw error;
        }

        await connection.commit();
        return { id: resultado.insertId, status: 'PENDING' };

    } catch (error) {
        await connection.rollback();

        if (error.code === 'ER_DUP_ENTRY') {
            const queryRecuperar = `SELECT id, user_id, amount, reference_number, request_id, deposit_destination_id, status FROM deposits WHERE request_id = ? OR reference_number = ? LIMIT 1`;
            const [rows] = await pool.query(queryRecuperar, [requestId, referenceNumber]);
            if (rows.length > 0) {
                if (rows[0].request_id !== requestId) {
                    throw conflict('REFERENCE_ALREADY_USED', 'EL NÚMERO DE REFERENCIA YA FUE UTILIZADO');
                }
                return validateReplay(rows[0], userId, amount, referenceNumber, destinationId);
            }
        }
        throw error;
        } finally {
            connection.release();
        }
        },

        async buscarDepositoPorRequestId(requestId){
            const query = 'SELECT id, request_id, status FROM deposits WHERE request_id = ? LIMIT 1'
            const [rows] = await pool.query(query, [requestId])
            return rows[0]
        },

        async listarDepositosUsuario(userId, filters, limit, offset) {
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
                SELECT d.id, d.amount, d.reference_number, d.request_id, d.status, d.rejection_reason,
                       d.reviewed_at, d.created_at,
                       dd.id AS destination_id, dd.type AS destination_type,
                       dd.destination_value, dd.account_holder, dd.version AS destination_version
                FROM deposits d
                LEFT JOIN deposit_destinations dd ON dd.id = d.deposit_destination_id
                WHERE ${conditions.map(condition => `d.${condition}`).join(' AND ')}
                ORDER BY d.created_at DESC, d.id DESC LIMIT ? OFFSET ?`, [...params, String(limit), String(offset)]);
            const [[count]] = await pool.execute(`SELECT COUNT(*) AS total FROM deposits WHERE ${where}`, params);
            return { rows, total: count.total };
        },

        async obtenerDepositoUsuario(userId, depositId) {
            const [rows] = await pool.query(`
                SELECT d.id, d.amount, d.reference_number, d.request_id, d.status, d.rejection_reason,
                       d.reviewed_at, d.created_at,
                       dd.id AS destination_id, dd.type AS destination_type,
                       dd.destination_value, dd.account_holder, dd.version AS destination_version
                FROM deposits d
                LEFT JOIN deposit_destinations dd ON dd.id = d.deposit_destination_id
                WHERE d.id = ? AND d.user_id = ? LIMIT 1`, [depositId, userId]);
            return rows[0];
        },
    }
}
