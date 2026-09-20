export function iniciarBaseDeDatosWallet(pool) {
    return {
        async obtenerWalletPorUserId(userId) {
            const query = `
                SELECT id, available_balance, held_balance, updated_at
                FROM wallets
                WHERE user_id = ?
                LIMIT 1
            `;
            const [rows] = await pool.query(query, [userId]);
            return rows[0];
        },

        async obtenerTransaccionesPorUserId(userId, limit, offset) {
            const dataQuery = `
                SELECT wt.id, wt.type, wt.amount, wt.balance_before, wt.balance_after,
                wt.reference_type, wt.reference_id, wt.status, wt.created_at
                FROM wallet_transactions wt
                INNER JOIN wallets w ON wt.wallet_id = w.id
                WHERE w.user_id = ?
                ORDER BY wt.created_at DESC
                LIMIT ? OFFSET ?
            `;

            const countQuery = `
                SELECT COUNT(*) AS total
                FROM wallet_transactions wt
                INNER JOIN wallets w ON wt.wallet_id = w.id
                WHERE w.user_id = ?
            `;

            const [[rows], [[countResult]]] = await Promise.all([
                pool.execute(dataQuery, [userId, limit.toString(), offset.toString()]),
                pool.execute(countQuery, [userId])
            ]);

            return {
                rows,
                total: countResult.total
            };
        }
    };
}
