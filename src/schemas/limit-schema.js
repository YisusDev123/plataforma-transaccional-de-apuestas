import Joi from "joi";
import { nonNegativeMoneySchema } from "./common-schema.js";

export const modificarLimiteSchema = Joi.object({
    draw_id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            "number.base": "EL ID DEL SORTEO DEBE SER UN NÚMERO VÁLIDO",
            "any.required": "EL ID DEL SORTEO ES OBLIGATORIO"
        }),

    number_played: Joi.number()
        .integer()
        .min(0)
        .max(99)
        .required()
        .messages({
            "number.base": "EL NUMERO JUGADO ES OBLIGATORIO Y DEBE SER FORMATO NUMERO",
            "number.min": "EL NUMERO JUGADO NO PUEDE SER MENOR A 0",
            "number.max": "EL NUMERO JUGADO NO PUEDE SER MAYOR A 99",
            "any.required": "EL NUMERO JUGADO ES OBLIGATORIO"
        }),

    max_amount: nonNegativeMoneySchema
        .optional()
        .messages({
            "number.base": "EL MONTO MÁXIMO DEBE SER UN NÚMERO VÁLIDO",
            "number.min": "EL MONTO MÁXIMO DE RIESGO NO PUEDE SER NEGATIVO",
            "any.required": "EL MONTO MÁXIMO ES OBLIGATORIO"
        }),

    remaining_amount: nonNegativeMoneySchema.optional().messages({
        "number.base": "EL MONTO DISPONIBLE DEBE SER UN NÃšMERO VÃLIDO",
        "number.min": "EL MONTO DISPONIBLE NO PUEDE SER NEGATIVO"
    }),

    expected_max_amount: nonNegativeMoneySchema.optional()
}).xor('max_amount', 'remaining_amount').messages({
    "object.xor": "DEBES ENVIAR EXACTAMENTE UNO DE ESTOS CAMPOS: max_amount O remaining_amount"
});
