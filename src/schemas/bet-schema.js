import Joi from "joi";
import { positiveMoneySchema, requestIdSchema } from "./common-schema.js";

export const createBetSchema = Joi.object({
    request_id: requestIdSchema
        .required()
        .messages({
            "string.empty": "EL REQUEST ID ES REQUERIDO",
            "any.required": "EL REQUEST ID ES REQUERIDO"
        }),

    bets: Joi.array()
        .items(
            Joi.object({
                draw_id: Joi.number()
                    .integer()
                    .positive()
                    .required()
                    .messages({
                        "number.base": "EL ID DEL SORTEO DEBE SER UN NÚMERO VÁLIDO",
                        "any.required": "EL ID DEL SORTEO ES OBLIGATORIO"
                    }),
                number_played: Joi.string()
                    .trim()
                    .pattern(/^\d{2}$/)
                    .required()
                    .messages({
                        "string.empty": "EL NÚMERO JUGADO NO PUEDE ESTAR VACÍO",
                        "string.pattern.base": "EL NÚMERO JUGADO DEBE TENER EXACTAMENTE 2 DÍGITOS (EJ. 00-99)",
                        "any.required": "EL NÚMERO JUGADO ES OBLIGATORIO"
                    }),
                amount: positiveMoneySchema
                    .required()
                    .messages({
                        "number.base": "EL MONTO DE LA APUESTA DEBE SER UN NÚMERO VÁLIDO",
                        "number.positive": "EL MONTO DE LA APUESTA DEBE SER MAYOR A 0",
                        "any.required": "EL MONTO DE LA APUESTA ES REQUERIDO"
                    })
            })
        )
        .min(1)
        .max(100)
        .unique((first, second) => (
            Number(first.draw_id) === Number(second.draw_id)
            && first.number_played === second.number_played
        ))
        .required()
        .messages({
            "array.base": "EL CAMPO 'bets' DEBE SER UN ARRAY",
            "array.min": "FALTAN CAMPOS POR ESPECIFICAR EN LA APUESTA",
            "array.max": "UN TICKET NO PUEDE CONTENER MÁS DE 100 JUGADAS",
            "array.unique": "NO SE PUEDE REPETIR EL MISMO NÚMERO DEL MISMO SORTEO EN UN TICKET",
            "any.required": "EL ARRAY DE APUESTAS ES OBLIGATORIO"
        })
});
