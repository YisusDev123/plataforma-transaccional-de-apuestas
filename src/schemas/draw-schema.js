
import Joi from "joi";
import { paginationQuerySchema } from "./common-schema.js";

export const adminDrawsQuerySchema = paginationQuerySchema.concat(Joi.object({
    status: Joi.string()
        .trim()
        .uppercase()
        .valid("PENDING", "OPEN", "CLOSED", "RESULT_LOADED", "PAID", "CANCELLED")
        .default("CLOSED")
}));

const listDateSchema = Joi.string()
    .trim()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .messages({
        'string.pattern.base': 'LA FECHA DEBE USAR EL FORMATO AAAA-MM-DD'
    });

export const adminDrawListQuerySchema = paginationQuerySchema.concat(Joi.object({
    view: Joi.string().trim().uppercase().valid('TODAY', 'HISTORY').default('TODAY'),
    date_from: listDateSchema,
    date_to: listDateSchema,
    lottery: Joi.string().trim().uppercase().valid('NICA', 'TICA'),
    modality: Joi.string().trim().uppercase().valid('NORMAL', 'MEGA_REVENTADO'),
    status: Joi.string()
        .trim()
        .uppercase()
        .valid('PENDING', 'OPEN', 'CLOSED', 'RESULT_LOADED', 'PAID', 'CANCELLED')
}));

export const loadResultsSchema = Joi.object({
    results: Joi.array()
        .items(
            Joi.object({
                draw_id: Joi.number()
                    .integer()
                    .positive()
                    .required()
                    .messages({
                        "number.base": "EL ID DEL SORTEO DEBE SER UN NÚMERO VÁLIDO",
                        "any.required": "EL ID DEL SORTEO ES OBLIGATORIO POR CADA ELEMENTO"
                    }),
                winning_number: Joi.number()
                    .integer()
                    .min(0)
                    .max(99)
                    .required()
                    .messages({
                        "number.base": "EL NÚMERO GANADOR DEBE SER UN NÚMERO VÁLIDO",
                        "number.min": "EL NÚMERO GANADOR NO PUEDE SER MENOR A 0",
                        "number.max": "EL NÚMERO GANADOR NO PUEDE SER MAYOR A 99",
                        "any.required": "EL NÚMERO GANADOR ES OBLIGATORIO"
                    })
            })
        )
        .min(1)
        .max(100)
        .unique('draw_id')
        .required()
        .messages({
            "array.base": "EL CAMPO 'results' DEBE SER UN ARRAY",
            "array.min": "EL ARRAY 'results' DEBE CONTENER AL MENOS UN RESULTADO",
            "array.max": "NO SE PUEDEN CARGAR MÁS DE 100 RESULTADOS POR SOLICITUD",
            "array.unique": "NO SE PUEDE REPETIR EL MISMO SORTEO EN LA CARGA DE RESULTADOS",
            "any.required": "EL ARRAY 'results' ES OBLIGATORIO Y NO PUEDE ESTAR VACÍO"
        })
});

export const drawParamSchema = Joi.object({
    id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            "number.base": "EL ID DEL SORTEO EN LA URL DEBE SER UN NÚMERO VÁLIDO",
            "any.required": "EL ID DEL SORTEO ES OBLIGATORIO"
        })
});
