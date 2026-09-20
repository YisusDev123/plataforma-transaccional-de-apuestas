export function iniciarCancelDrawService(cancelDrawSql) {
    return {
        async executeCancel(drawId) {
            if (!drawId || isNaN(drawId)) {
                const error = new Error("El ID del sorteo proporcionado no es válido.");
                error.statusCode = 400;
                throw error;
            }

            const result = await cancelDrawSql.executeCancelAndRefund(drawId);


            console.log(`[INFO] Sorteo #${drawId} cancelado y reembolsado correctamente.`);

            return {
                message: "El sorteo ha sido cancelado y los fondos reembolsados exitosamente.",
                stats: result
            };
        }
    };
}
