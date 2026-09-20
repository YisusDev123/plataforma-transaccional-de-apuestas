import Joi from "joi";
import { plainTextSchema, positiveMoneySchema, requestIdSchema } from "./common-schema.js";

export const requestWithdrawalSchema = Joi.object({
    amount: positiveMoneySchema
        .required()
        .messages({
            "number.base": "EL MONTO DE DEPÓSITO ES REQUERIDO Y DEBE SER UN NÚMERO",
            "number.positive": "EL MONTO MINIMO DE RETIRO DEBE SER POSITIVO",
            "any.required": "EL MONTO DE DEPÓSITO ES REQUERIDO"
        }),

    destinationAccount: plainTextSchema({ min: 1, max: 255 })
        .required()
        .messages({
            "string.empty": "LA CUENTA DESTINO ES REQUERIDA",
            "string.max": "LA CUENTA DESTINO NO PUEDE EXCEDER LOS 255 CARACTERES",
            "any.required": "LA CUENTA DESTINO ES REQUERIDA"
        }),

    destinationAccountHolder: plainTextSchema({ min: 1, max: 255 })
        .required()
        .messages({
            "string.empty": "EL NOMBRE DEL TITULAR ES REQUERIDO",
            "string.max": "EL NOMBRE DEL TITULAR NO PUEDE EXCEDER LOS 255 CARACTERES",
            "any.required": "EL NOMBRE DEL TITULAR ES REQUERIDO"
        }),

    requestId: requestIdSchema
        .required()
        .messages({
            "string.empty": "EL ID DE LA SOLICITUD (REQUEST ID) ES REQUERIDO",
            "any.required": "EL ID DE LA SOLICITUD (REQUEST ID) ES REQUERIDO"
        })
});
