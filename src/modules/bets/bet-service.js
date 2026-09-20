import { createBetReceiptData } from './bet-receipt.js';

export async function createBetService(betSql, settingsService, limitSql, userId, requestId, bets) {

        const systemStatus = settingsService.get("system_status");

        if (!systemStatus
            || typeof systemStatus.maintenance_mode !== "boolean"
            || typeof systemStatus.sales_enabled !== "boolean") {
            const error = new Error("No se pudo verificar la disponibilidad del sistema. Intente más tarde.");
            error.statusCode = 503;
            error.publicCode = "SYSTEM_STATUS_UNAVAILABLE";
            throw error;
        }

        if (systemStatus.maintenance_mode === true) {
            const customMessage = typeof systemStatus.message === "string"
                ? systemStatus.message.trim()
                : "";
            const error = new Error(customMessage || "El sistema se encuentra temporalmente en mantenimiento.");
            error.statusCode = 503;
            error.publicCode = "MAINTENANCE_MODE";
            throw error;
        }

        if (systemStatus.sales_enabled === false) {
            const error = new Error("La venta de apuestas se encuentra temporalmente suspendida.");
            error.statusCode = 503;
            error.publicCode = "SALES_DISABLED";
            throw error;
        }

        const replay = await betSql.recoverReplay(userId, requestId, bets);
        if (replay) {
            return {
                ticket_code: replay.ticket_code,
                bet_id: replay.bet_id,
                total_amount: money(replay.total_amount),
                status: "CONFIRMED"
            };
        }

        const financialRules = settingsService.get("financial_rules");

        if (!financialRules) {
            const error = new Error("No se pudieron verificar los límites financieros del sistema.");
            error.statusCode = 503;
            error.publicCode = "BET_RULES_UNAVAILABLE";
            throw error;
        }

        let totalTicketAmount = 0;

        for (const item of bets) {
            const amountNum = Number(item.amount);

            if (isNaN(amountNum) || amountNum < financialRules.min_bet_per_number) {
                const error = new Error(`El monto mínimo por apuesta es de ₡${financialRules.min_bet_per_number} por número.`);
                error.statusCode = 400;
                error.publicCode = "MIN_BET_NOT_MET";
                throw error;
            }

            const limiteDisponible = await limitSql.obtenerLimiteDisponible(item.draw_id, item.number_played);

            if (limiteDisponible === null) {
                const error = new Error(`El número ${item.number_played} no está disponible o el sorteo no existe.`);
                error.statusCode = 400;
                error.publicCode = "DRAW_OR_NUMBER_UNAVAILABLE";
                throw error;
            }

            if (amountNum > limiteDisponible) {
                const error = new Error(`Límite excedido. Solo quedan ₡${limiteDisponible} disponibles para el número ${item.number_played}.`);
                error.statusCode = 400;
                error.publicCode = "NUMBER_LIMIT_EXCEEDED";
                throw error;
            }

            totalTicketAmount += amountNum;
        }

        if (totalTicketAmount > financialRules.max_ticket_total) {
            const error = new Error(`El monto total del ticket supera el límite permitido de ₡${financialRules.max_ticket_total}.`);
            error.statusCode = 400;
            error.publicCode = "MAX_TICKET_TOTAL_EXCEEDED";
            throw error;
        }

        const resultado = await betSql.processBetTransaction(userId, requestId, bets);

        return {
            ticket_code: resultado.ticket_code,
            bet_id: resultado.bet_id,
            total_amount: resultado.total_amount,
            status: "CONFIRMED"
        };
}

function money(value) {
    const normalized = String(value ?? '0');
    const [whole, decimal = ''] = normalized.split('.');
    return `${whole}.${decimal.padEnd(2, '0').slice(0, 2)}`;
}

export async function listBetHistory(betSql, userId, filters, limit, offset) {
    const result = await betSql.listarApuestasUsuario(userId, filters, limit, offset);
    return {
        tickets: result.rows.map(row => ({
            id: row.id,
            ticketCode: row.ticket_code,
            requestId: row.request_id,
            totalAmount: money(row.total_amount),
            status: row.status,
            itemCount: Number(row.item_count),
            totalPayout: money(row.total_payout),
            totalRefunded: money(row.total_refunded),
            createdAt: row.created_at
        })),
        total: result.total
    };
}

function serializeBetDetail(result, { includeCustomer = false } = {}) {
    const detail = {
        id: result.bet.id,
        ticketCode: result.bet.ticket_code,
        totalAmount: money(result.bet.total_amount),
        status: result.bet.status,
        createdAt: result.bet.created_at,
        receiptAvailable: Boolean(result.bet.receipt_available),
        items: result.items.map(item => ({
            id: item.id,
            draw: {
                id: item.draw_id,
                lottery: item.lottery,
                modality: item.modality,
                drawDate: item.draw_date,
                scheduleTime: item.schedule_time,
                status: item.draw_status,
                winningNumber: item.result_number || null
            },
            numberPlayed: item.number_played,
            amount: money(item.amount),
            multiplierSnapshot: String(item.payout_multiplier_snapshot),
            status: item.status,
            payoutProcessed: Boolean(item.payout_processed),
            potentialPayout: money(item.potential_payout),
            payoutAmount: money(item.payout_amount)
        }))
    };
    if (result.bet.request_id != null) detail.requestId = result.bet.request_id;
    if (includeCustomer) {
        detail.userId = result.bet.user_id;
        detail.customerName = result.bet.customer_name || null;
    }
    return detail;
}

export async function getBetDetail(betSql, userId, betId) {
    const result = await betSql.obtenerApuestaUsuario(userId, betId);
    if (!result) {
        const error = new Error('APUESTA NO ENCONTRADA');
        error.statusCode = 404;
        throw error;
    }
    return serializeBetDetail(result);
}

function receiptNotFound() {
    const error = new Error('El comprobante no existe o no está disponible.');
    error.statusCode = 404;
    error.publicCode = 'BET_RECEIPT_NOT_AVAILABLE';
    return error;
}

function buildReceipt(result) {
    return createBetReceiptData({
        acceptedAt: result.bet.created_at,
        customerName: result.bet.customer_name_snapshot,
        ticketCode: result.bet.ticket_code,
        totalAmount: result.bet.total_amount,
        items: result.items.map(item => ({
            drawId: item.draw_id,
            lottery: item.lottery,
            modality: item.modality,
            drawDate: item.draw_date,
            scheduleTime: item.schedule_time,
            numberPlayed: item.number_played,
            amount: item.amount,
            multiplier: item.payout_multiplier_snapshot
        }))
    });
}

export async function getUserBetReceipt(betSql, userId, betId) {
    const result = await betSql.obtenerComprobanteUsuario(userId, betId);
    if (!result) throw receiptNotFound();
    return { ticketCode: result.bet.ticket_code, receipt: buildReceipt(result) };
}

export async function listAdminBets(betSql, filters, limit, offset) {
    const result = await betSql.listarApuestasAdmin(filters, limit, offset);
    return {
        tickets: result.rows.map(row => ({
            id: row.id,
            ticketCode: row.ticket_code,
            customerName: row.customer_name || null,
            totalAmount: money(row.total_amount),
            status: row.status,
            itemCount: Number(row.item_count),
            receiptAvailable: Boolean(row.receipt_available),
            createdAt: row.created_at
        })),
        total: result.total
    };
}

export async function getAdminBetDetail(betSql, betId) {
    const result = await betSql.obtenerApuestaAdmin(betId);
    if (!result) {
        const error = new Error('APUESTA NO ENCONTRADA');
        error.statusCode = 404;
        throw error;
    }
    return serializeBetDetail(result, { includeCustomer: true });
}

export async function getAdminBetReceipt(betSql, betId) {
    const result = await betSql.obtenerComprobanteAdmin(betId);
    if (!result) throw receiptNotFound();
    return { ticketCode: result.bet.ticket_code, receipt: buildReceipt(result) };
}
