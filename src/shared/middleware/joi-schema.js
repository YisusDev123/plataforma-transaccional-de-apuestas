import { settingsBodySchemas } from "./../../schemas/setting-schema.js";

/**
 * Motor genérico de validación con Joi.
 * @param {Object} schema - El esquema de Joi a evaluar.
 * @param {String} source - El origen de los datos: 'body', 'query' o 'params'. Por defecto 'body'.
 */
export function validar(schema, source = 'body') {
    return (req, res, next) => {
        const input = req.validated?.[source] ?? req[source];
        const { error, value } = schema.validate(input, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const mensajesLimpios = error.details
                .map(err => err.message.replace(/"/g, ''))
                .join(', ');

            const validationError = new Error(`Campos inválidos: ${mensajesLimpios}`);
            validationError.statusCode = 400;
            return next(validationError);
        }

        req.validated = req.validated || {};
        req.validated[source] = value;

        if (source === 'params') {
            Object.keys(req[source]).forEach(key => {
                delete req[source][key];
            });
            Object.assign(req[source], value);
        } else if (source !== 'query') {
            req[source] = value;
        }

        next();
    };
}

export function validarSettingsBody() {
    return (req, res, next) => {
        const { key } = req.params;
        const schema = settingsBodySchemas[key];

        if (!schema) {
            const error = new Error(`No se encontró un validador estructural para el módulo: ${key}`);
            error.statusCode = 400;
            return next(error);
        }

        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const mensajesLimpios = error.details
                .map(err => err.message.replace(/"/g, ''))
                .join(', ');

            const validationError = new Error(`Campos inválidos en la configuración: ${mensajesLimpios}`);
            validationError.statusCode = 400;
            return next(validationError);
        }

        req.body = value;
        req.validated = req.validated || {};
        req.validated.body = value;
        next();
    };
}
