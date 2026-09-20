import Joi from "joi";
import {
    emailSchema,
    loginPasswordSchema,
    newPasswordSchema,
    paginationQuerySchema,
    plainTextSchema
} from "./common-schema.js";

export const createAdminSchema = Joi.object({
    email: emailSchema
        .required()
        .messages({
            "string.empty": "EL CORREO ELECTRÓNICO ES REQUERIDO",
            "string.email": "EL FORMATO DEL CORREO ELECTRÓNICO NO ES VÁLIDO",
            "any.required": "EL CORREO ELECTRÓNICO ES OBLIGATORIO"
        }),
    password: newPasswordSchema
        .required()
        .messages({
            "string.empty": "LA CONTRASEÑA NO PUEDE ESTAR VACÍA",
            "string.min": "LA CONTRASEÑA DEBE TENER AL MENOS 6 CARACTERES",
            "any.required": "LA CONTRASEÑA ES OBLIGATORIA"
        }),
    role: Joi.string()
        .trim()
        .uppercase()
        .valid("EMPLOYEE")
        .required()
        .messages({
            "string.empty": "EL ROL ES REQUERIDO",
            "any.only": "EL ROL DEBE SER 'EMPLOYE'",
            "any.required": "EL ROL ES OBLIGATORIO"
        })
});

export const adminIdParamSchema = Joi.object({
    id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            "number.base": "EL ID DEBE SER UN NÚMERO VÁLIDO",
            "number.integer": "EL ID DEBE SER UN NÚMERO ENTERO",
            "number.positive": "EL ID DEBE SER UN NÚMERO POSITIVO",
            "any.required": "EL ID DEL ADMINISTRADOR ES OBLIGATORIO"
        })
});

export const getDepositsQuerySchema = paginationQuerySchema.concat(Joi.object({
    status: Joi.string()
        .trim()
        .uppercase()
        .valid("PENDING", "APPROVED", "REJECTED")
        .required()
        .messages({
            "string.empty": "EL PARÁMETRO STATUS ES REQUERIDO",
            "any.only": "EL STATUS DEBE SER 'PENDING', 'APPROVED' O 'REJECTED'",
            "any.required": "EL PARÁMETRO STATUS ES OBLIGATORIO"
        })
}));

export const depositIdParamSchema = Joi.object({
    id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            "number.base": "EL ID DEL DEPÓSITO DEBE SER UN NÚMERO VÁLIDO",
            "number.integer": "EL ID DEL DEPÓSITO DEBE SER UN NÚMERO ENTERO",
            "number.positive": "EL ID DEL DEPÓSITO DEBE SER UN NÚMERO POSITIVO",
            "any.required": "EL ID DEL DEPÓSITO ES OBLIGATORIO"
        })
});

export const rejectDepositBodySchema = Joi.object({
    reason: plainTextSchema({ min: 5, max: 255 })
        .required()
        .messages({
            "string.empty": "EL MOTIVO DEL RECHAZO NO PUEDE ESTAR VACÍO",
            "string.min": "EL MOTIVO DEL RECHAZO DEBE TENER AL MENOS 5 CARACTERES",
            "string.max": "EL MOTIVO DEL RECHAZO NO PUEDE EXCEDER LOS 255 CARACTERES",
            "any.required": "EL MOTIVO DEL RECHAZO ES OBLIGATORIO"
        })
});

export const getWithdrawalsQuerySchema = paginationQuerySchema.concat(Joi.object({
    status: Joi.string()
        .trim()
        .uppercase()
        .valid("PENDING", "APPROVED", "REJECTED")
        .required()
        .messages({
            "string.empty": "EL PARÁMETRO STATUS ES REQUERIDO",
            "any.only": "EL STATUS DEBE SER 'PENDING', 'APPROVED' O 'REJECTED'",
            "any.required": "EL PARÁMETRO STATUS ES OBLIGATORIO"
        })
}));

export const withdrawalIdParamSchema = Joi.object({
    id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            "number.base": "EL ID DEL RETIRO DEBE SER UN NÚMERO VÁLIDO",
            "number.integer": "EL ID DEL RETIRO DEBE SER UN NÚMERO ENTERO",
            "number.positive": "EL ID DEL RETIRO DEBE SER UN NÚMERO POSITIVO",
            "any.required": "EL ID DEL RETIRO ES OBLIGATORIO"
        })
});

export const suspendUserBodySchema = Joi.object({
    userId: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            "number.base": "EL ID DEL USUARIO DEBE SER UN NÚMERO VÁLIDO",
            "number.integer": "EL ID DEL USUARIO DEBE SER UN NÚMERO ENTERO",
            "number.positive": "EL ID DEL USUARIO DEBE SER UN NÚMERO POSITIVO",
            "any.required": "EL 'Id usuario' ES REQUERIDO EN EL CUERPO DE LA PETICIÓN"
        }),
    reason: plainTextSchema({ min: 4, max: 500 })
        .required()
        .messages({
            "string.empty": "DEBE ESPECIFICAR UN MOTIVO PARA LA SUSPENSIÓN",
            "string.min": "EL MOTIVO DEBE SER MÁS EXPLICATIVO (MÍNIMO 4 CARACTERES)",
            "string.max": "EL MOTIVO DE LA SUSPENSIÓN NO PUEDE EXCEDER LOS 500 CARACTERES",
            "any.required": "EL MOTIVO DE LA SUSPENSIÓN ES OBLIGATORIO"
        })
});

export const userIdParamSchema = Joi.object({
    id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            "number.base": "EL ID DEL USUARIO DEBE SER UN NÚMERO VÁLIDO",
            "number.integer": "EL ID DEL USUARIO DEBE SER UN NÚMERO ENTERO",
            "number.positive": "EL ID DEL USUARIO DEBE SER UN NÚMERO POSITIVO",
            "any.required": "EL ID DEL USUARIO ES OBLIGATORIO EN LA URL"
        })
});

export const adminLoginSchema = Joi.object({
    email: emailSchema
        .required()
        .messages({
            "string.empty": "EL CORREO ELECTRÓNICO ES REQUERIDO",
            "string.email": "EL FORMATO DEL CORREO ELECTRÓNICO NO ES VÁLIDO",
            "any.required": "EL CORREO ELECTRÓNICO ES OBLIGATORIO"
        }),
    password: loginPasswordSchema
        .required()
        .messages({
            "string.empty": "LA CONTRASEÑA ES REQUERIDA",
            "any.required": "LA CONTRASEÑA ES OBLIGATORIA"
        })
});

export const listKycsQuerySchema = paginationQuerySchema.concat(Joi.object({
    status: Joi.string()
        .trim()
        .uppercase()
        .valid("PENDING", "APPROVED", "REJECTED")
        .default("PENDING")
        .messages({
            "any.only": "EL ESTADO DE FILTRO DEBE SER 'PENDING', 'APPROVED' O 'REJECTED'"
        })
}));

export const getUsersQuerySchema = paginationQuerySchema;

export const reviewKycBodySchema = Joi.object({
    id: Joi.number()
        .integer()
        .positive()
        .required()
        .messages({
            "number.base": "EL ID DEL KYC DEBE SER UN NÚMERO VÁLIDO",
            "number.integer": "EL ID DEL KYC DEBE SER UN NÚMERO ENTERO",
            "number.positive": "EL ID DEL KYC DEBE SER UN NÚMERO POSITIVO",
            "any.required": "EL ID DEL KYC ES OBLIGATORIO"
        }),
    status: Joi.string()
        .trim()
        .uppercase()
        .valid("APPROVED", "REJECTED")
        .required()
        .messages({
            "string.empty": "EL ESTADO DE LA REVISIÓN NO PUEDE ESTAR VACÍO",
            "any.only": "EL ESTADO DEBE SER ESTRICTAMENTE 'APPROVED' O 'REJECTED'",
            "any.required": "EL ESTADO DE LA REVISIÓN ES OBLIGATORIO"
        }),
    detalles: plainTextSchema({ min: 1, max: 500 })
        .required()
        .messages({
            "string.empty": "EL CAMPO DETALLES NO PUEDE ESTAR VACÍO",
            "string.max": "EL CAMPO DETALLES NO PUEDE EXCEDER LOS 500 CARACTERES",
            "any.required": "EL CAMPO DETALLES ES REQUERIDO PARA LA TRAZABILIDAD DEL LOG"
        })
});

export const rejectWithdrawalBodySchema = rejectDepositBodySchema;
export const webAdminSessionSchema = Joi.object({}).max(0);

function normalizeDepositDestination(value, helpers) {
    const normalized = String(value || '').replace(/[\s-]/g, '').toUpperCase();
    const type = helpers.state.ancestors[0]?.type;
    if (type === 'BANK_ACCOUNT' && !/^CR\d{20}$/.test(normalized)) {
        return helpers.error('depositDestination.bankAccount');
    }
    if (type === 'SINPE_MOVIL' && !/^\d{8}$/.test(normalized)) {
        return helpers.error('depositDestination.sinpe');
    }
    return normalized;
}

export const updateDepositDestinationSchema = Joi.object({
    type: Joi.string().trim().uppercase().valid('BANK_ACCOUNT', 'SINPE_MOVIL').required()
        .messages({
            'any.only': 'EL TIPO DE DESTINO DEBE SER CUENTA BANCARIA O SINPE MÓVIL',
            'any.required': 'EL TIPO DE DESTINO ES OBLIGATORIO'
        }),
    destinationValue: Joi.string().trim().max(34).custom(normalizeDepositDestination).required()
        .messages({
            'string.empty': 'LA CUENTA O TELÉFONO ES OBLIGATORIO',
            'string.max': 'LA CUENTA O TELÉFONO NO PUEDE EXCEDER 34 CARACTERES',
            'depositDestination.bankAccount': 'LA CUENTA DEBE SER UN IBAN DE COSTA RICA VÁLIDO',
            'depositDestination.sinpe': 'EL SINPE MÓVIL DEBE CONTENER 8 DÍGITOS',
            'any.required': 'LA CUENTA O TELÉFONO ES OBLIGATORIO'
        }),
    accountHolder: plainTextSchema({ min: 3, max: 255 }).required()
        .messages({
            'string.empty': 'EL NOMBRE DEL TITULAR ES OBLIGATORIO',
            'string.min': 'EL NOMBRE DEL TITULAR DEBE TENER AL MENOS 3 CARACTERES',
            'string.max': 'EL NOMBRE DEL TITULAR NO PUEDE EXCEDER 255 CARACTERES',
            'any.required': 'EL NOMBRE DEL TITULAR ES OBLIGATORIO'
        })
});
