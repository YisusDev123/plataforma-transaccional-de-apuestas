export async function crearSorteoService(pool, drawSql, limitsSql, settingsService, adminId, payload) {

    const drawDefaults = settingsService.get("draw_defaults");
    if (!drawDefaults) {
        const error = new Error("No se pudieron cargar las configuraciones por defecto del sorteo.");
        error.statusCode = 500;
        throw error;
    }

    const closeMinutes = Number(drawDefaults.auto_close_minutes_before);
    if (!Number.isInteger(closeMinutes) || closeMinutes < 10 || closeMinutes > 20) {
        const error = new Error("La regla de cierre anticipado debe estar entre 10 y 20 minutos.");
        error.statusCode = 500;
        throw error;
    }
    const minutesBeforeClose = closeMinutes;
    const openDateObject = new Date(`${payload.draw_date}T00:00:00-06:00`);
    const drawDateObject = new Date(`${payload.draw_date}T${payload.schedule_time}-06:00`);

    if (Number.isNaN(openDateObject.getTime()) || Number.isNaN(drawDateObject.getTime())) {
        const error = new Error("La fecha u hora proporcionada para el sorteo no es válida.");
        error.statusCode = 400;
        throw error;
    }

    const closeDateObject = new Date(drawDateObject.getTime() - (minutesBeforeClose * 60 * 1000));
    const openAtUTC = openDateObject.toISOString().slice(0, 19).replace('T', ' ');
    const closeAtUTC = closeDateObject.toISOString().slice(0, 19).replace('T', ' ');

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const newDrawId = await drawSql.insertarSorteo(connection, adminId, payload, openAtUTC, closeAtUTC);
        if(!newDrawId) {
            const error = new Error("No se pudo crear el sorteo en la base de datos.");
            error.statusCode = 500;
            throw error;
        }

        const montoRiesgoDefecto = drawDefaults.default_risk_limit;

        await limitsSql.inicializarLimitesSorteo(connection, newDrawId, montoRiesgoDefecto);

        await connection.commit();

        return {
            message: "Sorteo abierto exitosamente e inicializado con sus topes de riesgo dinámicos.",
            draw_id: newDrawId,
            risk_limit_applied: montoRiesgoDefecto
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

export async function loadResultsService(drawSql, eventBus, adminId, resultsPayload, ip, device) {
    const resultsToInsert = resultsPayload.map(r => {
        const winningNumber = Number(r.winning_number);
        if (!Number.isInteger(winningNumber) || winningNumber < 0 || winningNumber > 99) {
            const error = new Error("El número ganador debe ser un entero entre 00 y 99.");
            error.statusCode = 400;
            throw error;
        }

        return {
            draw_id: r.draw_id,
            winning_number: String(winningNumber).padStart(2, '0')
        };
    });

    await drawSql.saveResults(adminId, resultsToInsert, ip, device);

    const drawIds = resultsToInsert.map(r => r.draw_id);
    eventBus.emit('draw.results_loaded', { drawIds });

    return {
        message: "Resultados guardados correctamente. Los pagos se están procesando en segundo plano.",
        inserted_draws: resultsToInsert.length
    };
}

function formatearReglaMonetaria(value) {
    const rawValue = String(value ?? '');

    if (!/^\d+(?:\.\d{1,2})?$/.test(rawValue)) {
        const error = new Error("No se pudieron verificar las reglas financieras para consultar sorteos.");
        error.statusCode = 503;
        error.publicCode = "BET_RULES_UNAVAILABLE";
        throw error;
    }

    const [integerPart, decimalPart = ''] = rawValue.split('.');
    return `${integerPart}.${decimalPart.padEnd(2, '0')}`;
}

function obtenerReglasPublicas(settingsService) {
    const systemStatus = settingsService.get("system_status");
    const financialRules = settingsService.get("financial_rules");

    if (!systemStatus || typeof systemStatus.sales_enabled !== "boolean") {
        const error = new Error("No se pudo verificar el estado de ventas del sistema.");
        error.statusCode = 503;
        error.publicCode = "SYSTEM_STATUS_UNAVAILABLE";
        throw error;
    }

    if (!financialRules) {
        const error = new Error("No se pudieron verificar las reglas financieras para consultar sorteos.");
        error.statusCode = 503;
        error.publicCode = "BET_RULES_UNAVAILABLE";
        throw error;
    }

    return {
        sales_enabled: systemStatus.sales_enabled,
        currency: "CRC",
        timezone: "America/Costa_Rica",
        bet_rules: {
            min_bet_per_number: formatearReglaMonetaria(financialRules.min_bet_per_number),
            max_ticket_total: formatearReglaMonetaria(financialRules.max_ticket_total)
        }
    };
}

function obtenerReglaPremioPublica(row) {
    const version = Number(row.payout_rule_version);
    if (!Number.isInteger(version) || version < 1) {
        const error = new Error("No se pudo verificar el multiplicador de premio del sorteo.");
        error.statusCode = 503;
        error.publicCode = "PAYOUT_RULES_UNAVAILABLE";
        throw error;
    }
    return {
        payout_multiplier: formatearReglaMonetaria(row.payout_multiplier),
        payout_rule_version: version
    };
}

export async function listOpenDrawsService(drawSql, settingsService) {
    const rules = obtenerReglasPublicas(settingsService);
    const draws = await drawSql.listOpenDraws();

    return {
        ...rules,
        draws: draws.map((draw) => ({ ...draw, ...obtenerReglaPremioPublica(draw) }))
    };
}

export async function getDrawAvailabilityService(drawSql, settingsService, drawId) {
    const rules = obtenerReglasPublicas(settingsService);
    const rows = await drawSql.getDrawAvailability(drawId);

    if (!rows || rows.length === 0) {
        const error = new Error("El sorteo no existe, no está abierto o ya alcanzó su hora de cierre.");
        error.statusCode = 404;
        throw error;
    }

    if (rows.length !== 100) {
        const error = new Error("La disponibilidad del sorteo está temporalmente incompleta.");
        error.statusCode = 503;
        error.publicCode = "DRAW_LIMITS_INCOMPLETE";
        throw error;
    }

    const firstRow = rows[0];
    const draw = {
        draw_id: firstRow.draw_id,
        lottery: firstRow.lottery,
        modality: firstRow.modality,
        draw_date: firstRow.draw_date,
        schedule_time: firstRow.schedule_time,
        open_at: firstRow.open_at,
        close_at: firstRow.close_at,
        status: firstRow.status,
        ...obtenerReglaPremioPublica(firstRow)
    };
    const numbers = rows.map((row) => ({
        number: row.number_played,
        remaining_amount: String(row.remaining_amount),
        available: Number(row.available) === 1
    }));

    return {
        draw,
        ...rules,
        numbers
    };
}

export async function listAdminDrawsService(drawSql, status, limit, offset) {
    const { rows, total } = await drawSql.listAdminDraws(status, limit, offset);
    return { status, draws: rows, total };
}

function businessDateInCostaRica(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Costa_Rica',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(now);
    const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export async function listAdminDrawListService(drawSql, options) {
    const businessDate = businessDateInCostaRica();
    if (options.date_from && options.date_to && options.date_from > options.date_to) {
        const error = new Error('El rango de fechas no es válido.');
        error.statusCode = 400;
        error.publicCode = 'INVALID_DATE_RANGE';
        throw error;
    }
    const result = await drawSql.listAdminDrawList({
        ...options,
        businessDate,
        dateFrom: options.date_from,
        dateTo: options.date_to
    });
    const draws = result.draws.map((draw) => {
        return {
            draw_id: draw.id,
            lottery: draw.lottery,
            modality: draw.modality,
            draw_date: draw.draw_date,
            schedule_time: draw.schedule_time,
            status: draw.status,
            winning_number: draw.winning_number ?? draw.result_number ?? null,
            result_status: draw.processed_status || null,
            total_sold: Number(draw.total_sold || 0).toFixed(2),
            total_refunded: Number(draw.total_refunded || 0).toFixed(2),
            total_paid: Number(draw.total_amount_paid || 0).toFixed(2),
            numbers: draw.numbers.map((row) => ({
                number: String(row.number_played).padStart(2, '0'),
                sold_amount: Number(row.sold_amount || 0).toFixed(2),
                bet_count: Number(row.bet_count || 0),
                max_amount: Number(row.max_amount || 0).toFixed(2)
            }))
        };
    });
    return { view: options.view, business_date: businessDate, draws, total: result.total };
}

export async function getAdminDrawLimitsService(drawSql, drawId) {
    const rows = await drawSql.getAdminDrawLimits(drawId);
    if (!rows || rows.length === 0) {
        const error = new Error("El sorteo no existe o no tiene límites configurados.");
        error.statusCode = 404;
        throw error;
    }
    if (rows.length !== 100) {
        const error = new Error("La matriz de límites del sorteo está incompleta.");
        error.statusCode = 503;
        error.publicCode = "DRAW_LIMITS_INCOMPLETE";
        throw error;
    }
    const first = rows[0];
    return {
        draw: {
            draw_id: first.draw_id,
            lottery: first.lottery,
            modality: first.modality,
            draw_date: first.draw_date,
            schedule_time: first.schedule_time,
            status: first.status
        },
        numbers: rows.map((row) => ({
            number: row.number_played,
            max_amount: String(row.max_amount),
            current_amount: String(row.current_amount),
            remaining_amount: String(row.remaining_amount)
        }))
    };
}
