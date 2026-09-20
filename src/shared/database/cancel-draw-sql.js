export function iniciarCancelDrawSql(pool) {
    return {
        async executeCancelAndRefund(drawId) {
            const connection = await pool.getConnection();

                try {
                    await connection.beginTransaction();

                    const [draws] = await connection.query(`SELECT id, status FROM draws WHERE id = ? FOR UPDATE`, [drawId]);
                        if (draws.length === 0) {
                            const error = new Error("Sorteo no encontrado.");
                            error.statusCode = 404;
                            throw error;
                        }
                        if (draws[0].status === 'RESULT_LOADED' || draws[0].status === 'PAID') {
                            const error = new Error("No se puede cancelar un sorteo que ya tiene resultados o ha sido pagado.")
                            error.statusCode = 400;
                            throw error;
                        }
                        if (draws[0].status === 'CANCELLED') {
                            const error = new Error("El sorteo ya fue cancelado.");
                            error.statusCode = 409;
                            throw error;
                        }

                    const [cancelDraw] = await connection.query(`UPDATE draws SET status = 'CANCELLED' WHERE id = ?`, [drawId]);
                        if (cancelDraw.affectedRows === 0){
                            const error = new Error("No se pudo cancelar el sorteo.")
                            error.statusCode = 500;
                            throw error;
                        };

                    const [betItems] = await connection.query(`SELECT bi.id, bi.bet_id, b.user_id, bi.amount FROM bet_items bi JOIN bets b ON bi.bet_id = b.id
                        WHERE bi.draw_id = ? AND bi.status = 'ACTIVE'
                        ORDER BY bi.id
                        FOR UPDATE`,
                        [drawId]
                    );

                        let totalRefundedCents = 0;
                        let itemsCancelled = 0;
                    const affectedBetIds = new Set();

                    if (betItems.length > 0) {
                        for (const item of betItems) {
                            const query = `SELECT id, available_balance FROM wallets WHERE user_id = ? FOR UPDATE`
                            const [wallets] = await connection.query(query,[item.user_id]);

                        if (wallets.length === 0) {
                            const error = new Error("No se encontró la billetera para completar el reembolso.");
                            error.statusCode = 500;
                            throw error;
                        }
                        const wallet = wallets[0];

                        const balanceBeforeCents = Math.round(Number(wallet.available_balance) * 100);
                        const refundCents = Math.round(Number(item.amount) * 100);
                        const balanceAfterCents = balanceBeforeCents + refundCents;

                        const balanceBeforeStr = (balanceBeforeCents / 100).toFixed(2);
                        const balanceAfterStr = (balanceAfterCents / 100).toFixed(2);
                        const refundStr = (refundCents / 100).toFixed(2);

                        const query1 = `UPDATE wallets SET available_balance = ? WHERE id = ?`
                        const [upd] = await connection.query(query1,[balanceAfterStr, wallet.id]);

                        if (upd.affectedRows === 0) {
                            const error = new Error("No se pudo actualizar el balance del usuario.")
                            error.statusCode = 500;
                            throw error;
                        }
                        const insert = `INSERT INTO wallet_transactions
                            (wallet_id, type, amount, balance_before, balance_after, reference_type, reference_id, status)
                            VALUES (?, 'REFUND', ?, ?, ?, 'draw_cancellation', ?, 'COMPLETED')`
                        const [insertData] = await connection.query(insert,[wallet.id, refundStr, balanceBeforeStr, balanceAfterStr, drawId]);
                        if (insertData.affectedRows === 0) {
                            const error = new Error("No se pudo registrar la transacción de reembolso.");
                            error.statusCode = 500;
                            throw error;
                        }

                        const query2 = `UPDATE bet_items SET status = 'CANCELLED', payout_processed = 1 WHERE id = ?`
                        const [procesarRetorno] = await connection.query(query2,[item.id]);
                        if (procesarRetorno.affectedRows === 0) {
                            const error = new Error("No se pudo actualizar el estado del ticket.")
                            error.statusCode = 500;
                            throw error;
                        }

                        affectedBetIds.add(item.bet_id);
                        totalRefundedCents += refundCents;
                        itemsCancelled++;
                    }
                }

                if (affectedBetIds.size > 0) {
                    const updateBetQuery = `
                        UPDATE bets b
                        SET b.status = CASE
                            WHEN (SELECT COUNT(*) FROM bet_items WHERE bet_id = b.id AND status = 'ACTIVE') > 0 THEN b.status
                            WHEN (SELECT COUNT(*) FROM bet_items WHERE bet_id = b.id AND status = 'WON') > 0 THEN 'WON'
                            WHEN (SELECT COUNT(*) FROM bet_items WHERE bet_id = b.id) =
                                 (SELECT COUNT(*) FROM bet_items WHERE bet_id = b.id AND status = 'CANCELLED') THEN 'REFUNDED'
                            ELSE 'LOST'
                        END
                        WHERE b.id = ?;
                    `;

                    for (const betId of affectedBetIds) {
                        await connection.query(updateBetQuery, [betId]);
                    }
                }

                await connection.commit();
                return {
                    success: true,
                    totalRefunded: (totalRefundedCents / 100).toFixed(2),
                    itemsCancelled
                };

            } catch (error) {
                await connection.rollback();
                if (!error.statusCode || error.statusCode >= 500) {
                    console.error(`[CRÍTICO] Falló la cancelación transaccional del sorteo #${drawId}.`);
                }
                throw error;
            } finally {
                connection.release();
            }
        }
    };
}
