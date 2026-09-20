import Joi from "joi";
import { plainTextSchema, positiveMoneySchema } from "./common-schema.js";

export const AUTO_CLOSE_MINUTES_MIN = 10;
export const AUTO_CLOSE_MINUTES_MAX = 20;

export const settingsParamSchema = Joi.object({
    key: Joi.string()
        .valid(
            "system_status",
            "financial_rules",
            "draw_defaults",
            "kyc_policies",
            "deposits_rules",
            "withdraws_rules"
        )
        .required()
        .messages({
            "any.only": "La configuración '{#value}' no es un módulo válido del sistema."
        })
});

export const settingsBodySchemas = {
    system_status: Joi.object({
        maintenance_mode: Joi.boolean(),
        sales_enabled: Joi.boolean(),
        message: plainTextSchema({ max: 255, allowEmpty: true }).messages({
            "string.max": "EL MENSAJE DEL SISTEMA NO PUEDE EXCEDER LOS 255 CARACTERES"
        })
    }).min(1),

    financial_rules: Joi.object({
        min_bet_per_number: positiveMoneySchema,
        max_ticket_total: positiveMoneySchema
    }).min(1),

    draw_defaults: Joi.object({
        default_risk_limit: positiveMoneySchema,
        auto_close_minutes_before: Joi.number().integer()
            .min(AUTO_CLOSE_MINUTES_MIN)
            .max(AUTO_CLOSE_MINUTES_MAX)
    }).min(1),

    kyc_policies: Joi.object({
        require_kyc_for_deposits: Joi.boolean(),
        require_kyc_for_withdrawals: Joi.boolean()
    }).min(1),

    deposits_rules: Joi.object({
        min_deposit: positiveMoneySchema
    }).min(1),

    withdraws_rules: Joi.object({
        min_withdrawal: positiveMoneySchema
    }).min(1)
};
