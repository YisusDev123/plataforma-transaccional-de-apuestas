import Joi from 'joi';

export const payoutRuleParamSchema = Joi.object({
    id: Joi.number().integer().positive().required()
});

export const updatePayoutRuleSchema = Joi.object({
    multiplier: Joi.number()
        .greater(0)
        .max(99999999.99)
        .precision(2)
        .strict()
        .required(),
    expected_version: Joi.number()
        .integer()
        .positive()
        .strict()
        .required()
});
