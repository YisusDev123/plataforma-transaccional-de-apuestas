import Joi from 'joi';
import {
    emailSchema,
    loginPasswordSchema,
    newPasswordSchema,
    refreshTokenSchema,
    sixDigitCodeSchema
} from './common-schema.js';

const requiredEmail = emailSchema.required().messages({
    'string.empty': 'EL CORREO ELECTRÓNICO ES REQUERIDO',
    'any.required': 'EL CORREO ELECTRÓNICO ES OBLIGATORIO'
});

export const registerSchema = Joi.object({
    email: requiredEmail,
    password: newPasswordSchema.required().messages({
        'string.empty': 'LA CONTRASEÑA NO PUEDE ESTAR VACÍA',
        'any.required': 'LA CONTRASEÑA ES OBLIGATORIA'
    })
});

export const loginSchema = Joi.object({
    email: requiredEmail,
    password: loginPasswordSchema.required().messages({
        'string.empty': 'LA CONTRASEÑA ES REQUERIDA',
        'any.required': 'LA CONTRASEÑA ES OBLIGATORIA'
    })
});

export const verifyEmailSchema = Joi.object({
    email: requiredEmail,
    verificationCode: sixDigitCodeSchema.required().messages({
        'string.empty': 'EL CÓDIGO DE VERIFICACIÓN NO PUEDE ESTAR VACÍO',
        'any.required': 'EL CÓDIGO DE VERIFICACIÓN ES OBLIGATORIO'
    })
});

export const resendVerificationSchema = Joi.object({
    email: requiredEmail
});

export const forgotPasswordSchema = Joi.object({
    email: requiredEmail
});

export const resetPasswordSchema = Joi.object({
    email: requiredEmail,
    resetCode: sixDigitCodeSchema.required().messages({
        'string.empty': 'EL CÓDIGO DE RESTABLECIMIENTO NO PUEDE ESTAR VACÍO',
        'any.required': 'EL CÓDIGO DE RESTABLECIMIENTO ES OBLIGATORIO'
    }),
    newPassword: newPasswordSchema.required().messages({
        'string.empty': 'LA NUEVA CONTRASEÑA NO PUEDE ESTAR VACÍA',
        'any.required': 'LA NUEVA CONTRASEÑA ES OBLIGATORIA'
    })
});

export const webSessionSchema = Joi.object({}).max(0);

export const refreshSessionSchema = Joi.object({
    refreshToken: refreshTokenSchema.required()
});
