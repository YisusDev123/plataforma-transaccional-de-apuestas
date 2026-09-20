import Joi from 'joi';

const MAX_BCRYPT_BYTES = 72;

function enforceBcryptByteLength(value, helpers) {
    if (Buffer.byteLength(value, 'utf8') > MAX_BCRYPT_BYTES) {
        return helpers.error('string.maxBytes', { limit: MAX_BCRYPT_BYTES });
    }
    return value;
}

export const emailSchema = Joi.string()
    .trim()
    .lowercase()
    .max(254)
    .email()
    .messages({
        'string.email': 'EL FORMATO DEL CORREO ELECTRÓNICO NO ES VÁLIDO',
        'string.max': 'EL CORREO ELECTRÓNICO NO PUEDE EXCEDER 254 CARACTERES'
    });

export const loginPasswordSchema = Joi.string()
    .custom(enforceBcryptByteLength, 'límite de bytes de bcrypt')
    .messages({
        'string.maxBytes': 'LA CONTRASEÑA NO PUEDE EXCEDER 72 BYTES'
    });

export const newPasswordSchema = loginPasswordSchema
    .min(6)
    .messages({
        'string.min': 'LA CONTRASEÑA DEBE TENER AL MENOS 6 CARACTERES'
    });

export const sixDigitCodeSchema = Joi.string()
    .trim()
    .pattern(/^\d{6}$/)
    .messages({
        'string.pattern.base': 'EL CÓDIGO DEBE CONTENER EXACTAMENTE 6 DÍGITOS'
    });

export const refreshTokenSchema = Joi.string()
    .length(80)
    .pattern(/^[a-fA-F0-9]{80}$/)
    .messages({
        'string.length': 'EL REFRESH TOKEN NO TIENE LA LONGITUD VÁLIDA',
        'string.pattern.base': 'EL REFRESH TOKEN NO TIENE UN FORMATO VÁLIDO'
    });

export const requestIdSchema = Joi.string()
    .min(1)
    .max(255)
    .pattern(/^[A-Za-z0-9._:-]+$/)
    .messages({
        'string.max': 'EL ID DE LA SOLICITUD NO PUEDE EXCEDER 255 CARACTERES',
        'string.pattern.base': 'EL ID DE LA SOLICITUD CONTIENE CARACTERES NO PERMITIDOS'
    });

export const paginationQuerySchema = Joi.object({
    page: Joi.number()
        .integer()
        .min(1)
        .default(1)
        .messages({
            'number.base': 'LA PÁGINA DEBE SER UN NÚMERO VÁLIDO',
            'number.integer': 'LA PÁGINA DEBE SER UN NÚMERO ENTERO',
            'number.min': 'LA PÁGINA DEBE SER MAYOR O IGUAL A 1'
        }),
    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(10)
        .messages({
            'number.base': 'EL LÍMITE DEBE SER UN NÚMERO VÁLIDO',
            'number.integer': 'EL LÍMITE DEBE SER UN NÚMERO ENTERO',
            'number.min': 'EL LÍMITE DEBE SER MAYOR O IGUAL A 1',
            'number.max': 'EL LÍMITE NO PUEDE EXCEDER 100'
        })
});

export function plainTextSchema({ min = 0, max = 255, allowEmpty = false, allowLineBreaks = false } = {}) {
    const controlCharacters = allowLineBreaks
        ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/
        : /[\u0000-\u001F\u007F-\u009F]/;

    let schema = Joi.string()
        .custom((value, helpers) => {
            if (controlCharacters.test(value)) {
                return helpers.error('string.plainText');
            }

            const normalizedValue = value.trim().normalize('NFC');
            if (/[<>]/.test(normalizedValue)) {
                return helpers.error('string.plainText');
            }
            if (!allowEmpty && normalizedValue.length === 0) {
                return helpers.error('string.empty');
            }

            return normalizedValue;
        }, 'texto plano seguro')
        .max(max)
        .messages({
            'string.plainText': 'EL TEXTO CONTIENE CARACTERES O MARKUP NO PERMITIDOS'
        });

    if (min > 0) schema = schema.min(min);
    if (allowEmpty) schema = schema.allow('');
    return schema;
}

export const MAX_SAFE_MONEY = Math.floor(Number.MAX_SAFE_INTEGER / 100);

const moneyBaseSchema = Joi.number()
    .precision(2)
    .strict()
    .max(MAX_SAFE_MONEY)
    .messages({
        'number.base': 'EL MONTO DEBE SER UN NÚMERO JSON VÁLIDO',
        'number.precision': 'EL MONTO NO PUEDE TENER MÁS DE 2 DECIMALES',
        'number.max': 'EL MONTO EXCEDE EL MÁXIMO SEGURO PERMITIDO'
    });

export const positiveMoneySchema = moneyBaseSchema
    .greater(0)
    .messages({
        'number.greater': 'EL MONTO DEBE SER MAYOR A 0'
    });

export const nonNegativeMoneySchema = moneyBaseSchema
    .min(0)
    .messages({
        'number.min': 'EL MONTO NO PUEDE SER NEGATIVO'
    });
