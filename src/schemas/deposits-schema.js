
import Joi from "joi";
import { plainTextSchema, positiveMoneySchema, requestIdSchema } from "./common-schema.js";

export const createDepositSchema = Joi.object({
    amount: positiveMoneySchema
        .required()
        .messages({
            "number.base": "EL MONTO DE DEPÓSITO DEBE SER UN NÚMERO VÁLIDO",
            "number.positive": "EL MONTO DE DEPÓSITO DEBE SER MAYOR A 0",
            "any.required": "EL MONTO DE DEPÓSITO ES REQUERIDO"
        }),

    referenceNumber: plainTextSchema({ min: 1, max: 255 })
        .required()
        .messages({
            "string.empty": "EL NUMERO DE REFERENCIA ES REQUERIDO",
            "string.max": "EL NUMERO DE REFERENCIA NO PUEDE EXCEDER LOS 255 CARACTERES",
            "any.required": "EL NUMERO DE REFERENCIA ES REQUERIDO"
        }),

    requestId: requestIdSchema
        .required()
        .messages({
            "string.empty": "EL ID DE LA SOLICITUD ES REQUERIDO",
            "any.required": "EL ID DE LA SOLICITUD ES REQUERIDO"
        }),

    destinationId: Joi.number().integer().positive().required()
        .messages({
            'number.base': 'EL DESTINO DE DEPÓSITO DEBE SER VÁLIDO',
            'number.integer': 'EL DESTINO DE DEPÓSITO DEBE SER VÁLIDO',
            'number.positive': 'EL DESTINO DE DEPÓSITO DEBE SER VÁLIDO',
            'any.required': 'EL DESTINO DE DEPÓSITO ES REQUERIDO'
        })
});
