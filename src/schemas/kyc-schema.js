import Joi from "joi";
import { plainTextSchema } from "./common-schema.js";

export const submitKycSchema = Joi.object({
    full_name: plainTextSchema({ min: 3, max: 255 })
        .pattern(/^(?=.*\p{L})[\p{L}\p{M} .'-]+$/u)
        .required()
        .messages({
            "string.empty": "EL NOMBRE COMPLETO ES OBLIGATORIO",
            "string.min": "EL NOMBRE COMPLETO DEBE TENER AL MENOS 3 CARACTERES",
            "string.max": "EL NOMBRE COMPLETO NO PUEDE EXCEDER LOS 255 CARACTERES",
            "string.pattern.base": "EL NOMBRE COMPLETO SOLO ADMITE LETRAS, ESPACIOS, APÓSTROFES, PUNTOS Y GUIONES",
            "any.required": "EL NOMBRE COMPLETO ES OBLIGATORIO"
        }),

    dni: Joi.string()
        .trim()
        .pattern(/^[0-9]+$/)
        .min(5)
        .required()
        .messages({
            "string.empty": "EL DNI ES OBLIGATORIO",
            "string.min": "EL DNI DEBE TENER AL MENOS 5 DÍGITOS",
            "string.pattern.base": "EL DNI SOLO DEBE CONTENER NÚMEROS",
            "any.required": "EL DNI ES OBLIGATORIO"
        })
});
