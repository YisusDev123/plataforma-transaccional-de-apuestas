const DEFAULT_MAINTENANCE_MESSAGE = "El sistema se encuentra temporalmente en mantenimiento.";
const SALES_DISABLED_MESSAGE = "La venta de apuestas se encuentra temporalmente suspendida.";
const SYSTEM_STATUS_UNAVAILABLE_MESSAGE = "No se pudo verificar la disponibilidad del sistema. Intente más tarde.";

function crearErrorDisponibilidad(message, publicCode) {
    const error = new Error(message);
    error.statusCode = 503;
    error.publicCode = publicCode;
    return error;
}

function obtenerSystemStatus(settingsService) {
    const systemStatus = settingsService.get("system_status");

    if (!systemStatus
        || typeof systemStatus.maintenance_mode !== "boolean"
        || typeof systemStatus.sales_enabled !== "boolean") {
        throw crearErrorDisponibilidad(
            SYSTEM_STATUS_UNAVAILABLE_MESSAGE,
            "SYSTEM_STATUS_UNAVAILABLE"
        );
    }

    return systemStatus;
}

function obtenerMensajeMantenimiento(systemStatus) {
    if (typeof systemStatus.message === "string" && systemStatus.message.trim()) {
        return systemStatus.message.trim();
    }

    return DEFAULT_MAINTENANCE_MESSAGE;
}

export function iniciarSystemAvailabilityMiddleware(settingsService) {
    return {
        maintenanceGuard(req, res, next) {
            try {
                if (req.admin?.role === "SUPER_ADMIN") {
                    return next();
                }

                const systemStatus = obtenerSystemStatus(settingsService);

                if (systemStatus.maintenance_mode === true) {
                    throw crearErrorDisponibilidad(
                        obtenerMensajeMantenimiento(systemStatus),
                        "MAINTENANCE_MODE"
                    );
                }

                next();
            } catch (error) {
                next(error);
            }
        },

        salesGuard(req, res, next) {
            try {
                const systemStatus = obtenerSystemStatus(settingsService);

                if (systemStatus.sales_enabled === false) {
                    throw crearErrorDisponibilidad(
                        SALES_DISABLED_MESSAGE,
                        "SALES_DISABLED"
                    );
                }

                next();
            } catch (error) {
                next(error);
            }
        }
    };
}
