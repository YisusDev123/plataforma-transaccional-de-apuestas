export async function ejecutarMotorDePagos(payoutSql) {
    const pendingResults = await payoutSql.getPendingResults();

    for (const result of pendingResults) {
        const resultLock = await payoutSql.acquireResultLock(result.id);
        if (!resultLock) continue;

        try {
            const claimed = await payoutSql.updateResultStatus(result.id, 'PROCESSING');
            if (!claimed) continue;

            let hasMoreItems = true;

            while (hasMoreItems) {
                const items = await payoutSql.getUnprocessedBetItems(result.draw_id, 100);

                if (items.length === 0) {
                    hasMoreItems = false;
                    await payoutSql.markResultCompleted(result.id, result.draw_id);
                    console.log(`[PAYOUT ENGINE] Sorteo ID ${result.draw_id} procesado exitosamente al 100%.`);
                    break;
                }

                for (const item of items) {
                    let processed;
                    if (item.number_played === result.winning_number) {
                        processed = await payoutSql.processWinner(item);
                    } else {
                        processed = await payoutSql.processLoser(item.id);
                    }

                    if (processed) {
                        await payoutSql.evaluateParentBet(item.bet_id);
                    }
                }
            }
        } finally {
            await payoutSql.releaseResultLock(resultLock);
        }
    }
}

export function iniciarPayoutSubscribers(payoutSql, eventBus, payoutExecutor = ejecutarMotorDePagos) {
    const listener = (data) => {
        console.log(`[PAYOUT SUBSCRIBER] 🔔 Evento detectado para sorteos: ${data.drawIds.join(', ')}. Activando motor de pagos...`);

        payoutExecutor(payoutSql).catch(() => {
            console.error("[CRITICAL] El suscriptor del motor de pagos falló.");
        });
    };
    eventBus.on('draw.results_loaded', listener);
    console.log("🎯 Suscriptores del módulo de Payout escuchando eventos globales.");
    return () => eventBus.off('draw.results_loaded', listener);
}
