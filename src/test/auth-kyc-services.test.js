import { describe, expect, jest, test } from '@jest/globals';
import bcrypt from 'bcrypt';
import { login, obtenerPerfil } from '../modules/auth/auth-services.js';
import { enviarKyc } from '../modules/kyc/kyc-services.js';
import { iniciarBaseDeDatos } from '../shared/database/auth-SQL.js';
import { iniciarBaseDeDatosKyc } from '../shared/database/kyc-sql.js';

describe('reglas de acceso de usuario', () => {
    test('el perfil propio incluye nombre completo y DNI registrados en KYC', async () => {
        const database = {
            obtenerUsuarioPorId: jest.fn().mockResolvedValue({
                id: 1,
                email: 'usuario@example.com',
                email_verified: 1,
                status: 'ACTIVE',
                kyc_status: 'APPROVED',
                full_name: 'José Pérez',
                dni: '123456789'
            })
        };

        await expect(obtenerPerfil(database, 1)).resolves.toEqual({
            id: 1,
            email: 'usuario@example.com',
            emailVerified: true,
            status: 'ACTIVE',
            kycStatus: 'APPROVED',
            fullName: 'José Pérez',
            dni: '123456789'
        });
    });

    test('la lectura del perfil consulta el KYC del mismo usuario sin exigir que exista', async () => {
        const pool = {
            query: jest.fn().mockResolvedValue([[
                { id: 1, full_name: 'José Pérez', dni: '123456789' }
            ]])
        };
        const database = iniciarBaseDeDatos(pool);

        await expect(database.obtenerUsuarioPorId(1)).resolves.toMatchObject({
            full_name: 'José Pérez',
            dni: '123456789'
        });
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringMatching(/LEFT JOIN user_kyc k ON k\.user_id = u\.id/),
            [1]
        );
        expect(pool.query.mock.calls[0][0]).toContain('COALESCE(k.kyc_status, u.kyc_status) AS kyc_status');
    });

    test('el perfil usa valores nulos cuando el usuario todavía no tiene KYC', async () => {
        const database = {
            obtenerUsuarioPorId: jest.fn().mockResolvedValue({
                id: 1,
                email: 'usuario@example.com',
                email_verified: 1,
                status: 'ACTIVE',
                kyc_status: 'UNVERIFIED'
            })
        };

        await expect(obtenerPerfil(database, 1)).resolves.toMatchObject({
            fullName: null,
            dni: null
        });
    });

    test('un usuario suspendido no puede iniciar sesión', async () => {
        const passwordHash = await bcrypt.hash('password', 4);
        const database = {
            buscarUsuarioPorEmail: jest.fn().mockResolvedValue({
                id: 1,
                email: 'suspendido@example.com',
                password_hash: passwordHash,
                email_verified: 1,
                status: 'SUSPENDED'
            })
        };

        await expect(login(database, 'suspendido@example.com', 'password', '127.0.0.1', 'test'))
            .rejects.toMatchObject({ statusCode: 403 });
    });

    test('un usuario sin correo verificado no puede enviar KYC', async () => {
        const dbUsers = {
            obtenerUsuarioPorId: jest.fn().mockResolvedValue({ id: 1, email_verified: 0 })
        };
        const dbKyc = {
            procesarKycTransaccional: jest.fn()
        };

        await expect(enviarKyc(dbKyc, dbUsers, 1, 'Usuario Prueba', '12345'))
            .rejects.toMatchObject({ statusCode: 403 });
        expect(dbKyc.procesarKycTransaccional).not.toHaveBeenCalled();
    });

    test.each([
        ['una cuenta nueva', []],
        ['una solicitud rechazada', [{ id: 4, kyc_status: 'REJECTED' }]]
    ])('el envío desde %s sincroniza la solicitud y el perfil como PENDING', async (_case, existingRows) => {
        const connection = {
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn(),
            query: jest.fn(async (sql) => {
                if (sql.includes('SELECT id, kyc_status FROM user_kyc')) return [existingRows];
                if (sql.includes('INSERT INTO user_kyc') || sql.includes('UPDATE user_kyc')) return [{ affectedRows: 1 }];
                if (sql.includes("UPDATE users SET kyc_status = 'PENDING'")) return [{ affectedRows: 1 }];
                throw new Error(`Consulta inesperada en prueba: ${sql}`);
            })
        };
        const database = iniciarBaseDeDatosKyc({
            getConnection: jest.fn().mockResolvedValue(connection)
        });

        await expect(database.procesarKycTransaccional(7, 'José Pérez', '123456789'))
            .resolves.toEqual({ message: 'DATOS ENVIADOS' });

        expect(connection.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE users SET kyc_status = 'PENDING'"),
            [7]
        );
        expect(connection.commit).toHaveBeenCalledTimes(1);
        expect(connection.rollback).not.toHaveBeenCalled();
        expect(connection.release).toHaveBeenCalledTimes(1);
    });

    test('revierte el envío completo si no puede sincronizar el estado del perfil', async () => {
        const connection = {
            beginTransaction: jest.fn(),
            commit: jest.fn(),
            rollback: jest.fn(),
            release: jest.fn(),
            query: jest.fn(async (sql) => {
                if (sql.includes('SELECT id, kyc_status FROM user_kyc')) return [[]];
                if (sql.includes('INSERT INTO user_kyc')) return [{ affectedRows: 1 }];
                if (sql.includes("UPDATE users SET kyc_status = 'PENDING'")) return [{ affectedRows: 0 }];
                throw new Error(`Consulta inesperada en prueba: ${sql}`);
            })
        };
        const database = iniciarBaseDeDatosKyc({
            getConnection: jest.fn().mockResolvedValue(connection)
        });

        await expect(database.procesarKycTransaccional(7, 'José Pérez', '123456789'))
            .rejects.toMatchObject({ statusCode: 500 });

        expect(connection.commit).not.toHaveBeenCalled();
        expect(connection.rollback).toHaveBeenCalledTimes(1);
        expect(connection.release).toHaveBeenCalledTimes(1);
    });
});
