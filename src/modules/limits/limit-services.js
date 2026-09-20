export async function inicializarLimitesSorteoService(limitsSql, connection, drawId, defaultMaxAmount) {
    await limitsSql.inicializarLimitesSorteo(connection, drawId, defaultMaxAmount);
}

export async function modificarMaxLimitesService(limitsSql, adminId, ip, device, drawId, numberPlayed, maxAmount, expectedMaxAmount, remainingAmount) {


    const numStr = String(numberPlayed).padStart(2, "0");
    const numInt = parseInt(numberPlayed, 10);

    if (numStr.length !== 2 || isNaN(numInt) || numInt < 0 || numInt > 99) {
        const error = new Error("El número jugado debe ser un valor válido entre 00 y 99.")
        error.statusCode = 400
        throw error
    }

    if (maxAmount !== undefined && maxAmount < 0) {
        const error = new Error("El monto máximo de riesgo no puede ser negativo.")
        error.statusCode = 400
        throw error
    }

    const actualizado = await limitsSql.actualizarMaxAmount(
        adminId, ip, device, drawId, numStr, maxAmount, expectedMaxAmount, remainingAmount
    );

    if (!actualizado) {
        const error = new Error("No se encontró el registro de límite para el sorteo o número especificado.")
        error.statusCode = 404
        throw error
    }

    return {
        message: "Disponibilidad del número actualizada con éxito por el administrador.",
        draw_id: drawId,
        number_played: numStr,
        previous_max_amount: String(actualizado.previousMaxAmount),
        new_max_amount: String(actualizado.newMaxAmount),
        current_amount: String(actualizado.currentAmount),
        remaining_amount: String(actualizado.remainingAmount),
        requested_remaining_amount: actualizado.requestedRemainingAmount === undefined
            ? undefined
            : String(actualizado.requestedRemainingAmount)
    };
}
