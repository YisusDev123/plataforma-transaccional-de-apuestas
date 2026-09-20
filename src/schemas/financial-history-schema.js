import Joi from 'joi';
import { paginationQuerySchema, requestIdSchema } from './common-schema.js';

export const ticketCodeSchema = Joi.string()
    .trim()
    .uppercase()
    .length(12)
    .pattern(/^[A-F0-9]{12}$/)
    .messages({
        'string.length': 'EL CÓDIGO DEL TICKET DEBE CONTENER 12 CARACTERES',
        'string.pattern.base': 'EL CÓDIGO DEL TICKET NO TIENE UN FORMATO VÁLIDO'
    });

export const financialIdParamSchema = Joi.object({
    id: Joi.number().integer().positive().required()
});

function historySchema(statuses) {
    return paginationQuerySchema.concat(Joi.object({
        status: Joi.string().trim().uppercase().valid(...statuses).optional(),
        requestId: requestIdSchema.optional()
    }));
}

export const betHistoryQuerySchema = historySchema(['CONFIRMED', 'WON', 'LOST', 'REFUNDED']).concat(Joi.object({
    ticketCode: ticketCodeSchema.optional()
}));
export const adminBetHistoryQuerySchema = paginationQuerySchema.concat(Joi.object({
    status: Joi.string().trim().uppercase().valid('CONFIRMED', 'WON', 'LOST', 'REFUNDED').optional(),
    ticketCode: ticketCodeSchema.optional(),
    dateFrom: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
}).custom((value, helpers) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
        return helpers.message({ custom: 'LA FECHA INICIAL NO PUEDE SER POSTERIOR A LA FECHA FINAL' });
    }
    return value;
}));
export const depositHistoryQuerySchema = historySchema(['PENDING', 'APPROVED', 'REJECTED']);
export const withdrawalHistoryQuerySchema = historySchema(['PENDING', 'APPROVED', 'REJECTED']);
