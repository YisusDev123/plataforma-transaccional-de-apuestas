import { calculatePayoutCents } from '../utils/decimal-money.js';

export function iniciarBaseDeDatosPayout(pool) {
    return {
        async getPendingResults() {
            const query = `SELECT id, draw_id, winning_number FROM draw_results WHERE processed_status IN ('PENDING', 'PROCESSING')`;
            const [rows] = await pool.query(query);
            return rows;
        },

        async acquireResultLock(resultId) {
            const connection = await pool.getConnection();
            const lockName = `lottery:payout:${resultId}`;

            try {
                const [[row]] = await connection.query(
                    `SELECT GET_LOCK(?, 0) AS acquired`,
                    [lockName]
                );

                if (Number(row.acquired) !== 1) {
                    connection.release();
                    return null;
                }

                return { connection, lockName };
            } catch (error) {
                connection.release();
                throw error;
            }
        },

        async releaseResultLock(lock) {
            if (!lock) return;

            try {
                await lock.connection.query(`SELECT RELEASE_LOCK(?)`, [lock.lockName]);
            } finally {
                lock.connection.release();
            }
        },

        async updateResultStatus(resultId, status) {
            const query = `UPDATE draw_results SET processed_status = ? WHERE id = ? AND processed_status IN ('PENDING', 'PROCESSING')`
            const [update] = await pool.query(query, [status, resultId]);
            return update.affectedRows === 1;
        },

        async getUnprocessedBetItems(drawId, limit = 100) {
            const query = `
                SELECT bi.id, bi.bet_id, bi.amount, bi.payout_multiplier_snapshot, bi.number_played, b.user_id
                FROM bet_items bi
                JOIN bets b ON bi.bet_id = b.id
                WHERE bi.draw_id = ? AND bi.payout_processed = 0
                LIMIT ?`;
            const [rows] = await pool.query(query, [drawId, limit]);
            return rows;
        },

        async processWinner(betItem) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const [items] = await connection.query(
                    `SELECT bi.id, bi.amount, bi.payout_multiplier_snapshot, bi.payout_processed, b.user_id
                     FROM bet_items bi
                     JOIN bets b ON b.id = bi.bet_id
                     WHERE bi.id = ?
                     FOR UPDATE`,
                    [betItem.id]
                );

                if (items.length === 0) {
                    const error = new Error("No se encontró el elemento de apuesta a pagar.");
                    error.statusCode = 404;
                    throw error;
                }

                const lockedItem = items[0];
                if (Number(lockedItem.payout_processed) === 1) {
                    await connection.rollback();
                    return false;
                }

                const [wallets] = await connection.query(
                    `SELECT id, available_balance FROM wallets WHERE user_id = ? FOR UPDATE`,
                    [lockedItem.user_id]
                );

                if (wallets.length === 0) {
                    const error = new Error("No se encontró la billetera del ganador.");
                    error.statusCode = 500;
                    throw error;
                }

                const wallet = wallets[0];

                const winCents = calculatePayoutCents(lockedItem.amount, lockedItem.payout_multiplier_snapshot);

                const balanceBeforeCents = Math.round(Number(wallet.available_balance) * 100);
                const balanceAfterCents = balanceBeforeCents + winCents;

                const balanceBeforeStr = (balanceBeforeCents / 100).toFixed(2);
                const balanceAfterStr = (balanceAfterCents / 100).toFixed(2);
                const winAmountStr = (winCents / 100).toFixed(2);

                const query = `UPDATE wallets SET available_balance = ? WHERE id = ?`
                const [actualizarW] = await connection.query(query, [balanceAfterStr, wallet.id]);
                if(actualizarW.affectedRows === 0) {
                    const error = new Error("No se pudo actualizar el balance del usuario.")
                    error.statusCode = 500;
                    throw error;
                }

                const registrar = `INSERT INTO wallet_transactions (wallet_id, type, amount, balance_before, balance_after, reference_type, reference_id, status) VALUES (?, 'BET_WIN', ?, ?, ?, 'bet_items', ?, 'COMPLETED')`
                const [registrarTrans] = await connection.query(registrar, [wallet.id, winAmountStr, balanceBeforeStr, balanceAfterStr, lockedItem.id]);
                if(registrarTrans.affectedRows === 0) {
                    const error = new Error("No se pudo registrar la transacción de ganancia.")
                    error.statusCode = 500;
                    throw error;
                }

                const [marcar] = await connection.query(
                    `UPDATE bet_items SET status = 'WON', payout_processed = 1 WHERE id = ? AND payout_processed = 0`,
                    [lockedItem.id]
                );
                if(marcar.affectedRows === 0) {
                    const error = new Error("No se pudo actualizar el estado del ticket.")
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
        },

        async processLoser(betItemId) {
            const [result] = await pool.query(
                `UPDATE bet_items SET status = 'LOST', payout_processed = 1 WHERE id = ? AND payout_processed = 0`,
                [betItemId]
            );
            return result.affectedRows === 1;
        },

        async evaluateParentBet(betId) {
            const query = `
                UPDATE bets b
                SET b.status = CASE
                    -- 1. Si queda AL MENOS UN sorteo en estado ACTIVE, el ticket se queda igual (CONFIRMED)
                    WHEN (SELECT COUNT(*) FROM bet_items WHERE bet_id = b.id AND status = 'ACTIVE') > 0 THEN b.status

                    -- 2. Si ya no hay activos y al menos UNO ganó, el ticket completo es WON
                    WHEN (SELECT COUNT(*) FROM bet_items WHERE bet_id = b.id AND status = 'WON') > 0 THEN 'WON'

                    -- 3. Si TODO fue cancelado (la cantidad total de items es igual a los cancelados), es REFUNDED
                    WHEN (SELECT COUNT(*) FROM bet_items WHERE bet_id = b.id) =
                         (SELECT COUNT(*) FROM bet_items WHERE bet_id = b.id AND status = 'CANCELLED') THEN 'REFUNDED'

                    -- 4. Si llegamos aquí: todos terminaron, ninguno ganó y no todo se canceló, entonces LOST
                    ELSE 'LOST'
                END
                WHERE b.id = ?;
            `;
            await pool.query(query, [betId]);
        },

        async markResultCompleted(resultId, drawId) {
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                await connection.query(`UPDATE draw_results SET processed_status = 'COMPLETED' WHERE id = ?`, [resultId]);
                await connection.query(`UPDATE draws SET status = 'PAID' WHERE id = ?`, [drawId]);

                const summaryQuery = `
                    INSERT INTO draw_payout_summaries (
                        draw_id,
                        winning_number,
                        total_tickets_played,
                        total_winners,
                        total_losers,
                        total_amount_paid,
                        status,
                        completed_at
                    )
                    SELECT
                        ?,
                        (SELECT winning_number FROM draw_results WHERE id = ?),
                        (SELECT COUNT(*) FROM bet_items WHERE draw_id = ?),
                        (SELECT COUNT(*) FROM bet_items WHERE draw_id = ? AND status = 'WON'),
                        (SELECT COUNT(*) FROM bet_items WHERE draw_id = ? AND status = 'LOST'),
                        COALESCE((
                            SELECT SUM(amount)
                            FROM wallet_transactions
                            WHERE reference_type = 'bet_items'
                            AND reference_id IN (SELECT id FROM bet_items WHERE draw_id = ? AND status = 'WON')
                        ), 0.00),
                        'COMPLETED',
                        CURRENT_TIMESTAMP
                    ON DUPLICATE KEY UPDATE
                        winning_number = VALUES(winning_number),
                        total_tickets_played = VALUES(total_tickets_played),
                        total_winners = VALUES(total_winners),
                        total_losers = VALUES(total_losers),
                        total_amount_paid = VALUES(total_amount_paid),
                        status = 'COMPLETED',
                        completed_at = CURRENT_TIMESTAMP;
                `;

                await connection.query(summaryQuery, [drawId, resultId, drawId, drawId, drawId, drawId]);

                await connection.commit();
            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }
        }
    };
}
