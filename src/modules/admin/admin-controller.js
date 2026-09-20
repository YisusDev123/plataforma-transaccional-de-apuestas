import { success } from "../../shared/utils/response.js";
import { createPaginationMetadata } from "../../shared/utils/pagination.js";
import { getRequestDevice } from "../../shared/utils/request-metadata.js";
import {
    ADMIN_REFRESH_COOKIE,
    clearRefreshCookie,
    readCookie,
    setRefreshCookie
} from "../../shared/utils/session-cookie.js";

export function iniciarAdminController(servicioAdmin, baseDeDatos, settingsService, depositDestinationDatabase) {
    return {
        async login(req, res, next) {
            try {
                const { email, password } = req.body;
                const ip = req.ip;
                const device = getRequestDevice(req);

                const contenido = await servicioAdmin.login(baseDeDatos, email, password, ip, device);
                const { refreshToken, ...publicContent } = contenido;
                setRefreshCookie(res, ADMIN_REFRESH_COOKIE, refreshToken, '/admin');
                success(req, res, publicContent, 200);
            } catch (error) {
                next(error);
            }
        },

        async me(req, res, next) {
            try {
                const contenido = await servicioAdmin.obtenerPerfilAdmin(baseDeDatos, req.admin.id);
                success(req, res, contenido, 200);
            } catch (error) {
                next(error);
            }
        },

        async summary(req, res, next) {
            try {
                const contenido = await servicioAdmin.obtenerResumenOperativo(baseDeDatos, settingsService);
                success(req, res, contenido, 200);
            } catch (error) {
                next(error);
            }
        },

        async obtenerDestinoDepositos(req, res, next) {
            try {
                const contenido = await servicioAdmin.obtenerDestinoDepositos(depositDestinationDatabase);
                success(req, res, contenido, 200);
            } catch (error) {
                next(error);
            }
        },

        async actualizarDestinoDepositos(req, res, next) {
            try {
                const contenido = await servicioAdmin.actualizarDestinoDepositos(
                    depositDestinationDatabase, req.admin.id, req.body, req.ip
                );
                success(req, res, contenido, 200);
            } catch (error) {
                next(error);
            }
        },

        async refresh(req, res, next) {
            try {
                const refreshToken = readCookie(req, ADMIN_REFRESH_COOKIE);
                const contenido = await servicioAdmin.refrescarAdmin(
                    baseDeDatos, refreshToken, req.ip, getRequestDevice(req)
                );
                const { refreshToken: nextRefreshToken, ...publicContent } = contenido;
                setRefreshCookie(res, ADMIN_REFRESH_COOKIE, nextRefreshToken, '/admin');
                success(req, res, publicContent, 200);
            } catch (error) {
                next(error);
            }
        },

        async logout(req, res, next) {
            try {
                const refreshToken = readCookie(req, ADMIN_REFRESH_COOKIE);
                const contenido = await servicioAdmin.logoutAdmin(baseDeDatos, refreshToken);
                clearRefreshCookie(res, ADMIN_REFRESH_COOKIE, '/admin');
                success(req, res, contenido, 200);
            } catch (error) {
                next(error);
            }
        },

        async crearAdmin(req, res, next) {
            try {
                const { email, password, role } = req.body;
                const creadorAdmin = req.admin.id
                const ip = req.ip;
                const device = getRequestDevice(req);

                const contenido = await servicioAdmin.crearNuevoAdmin(baseDeDatos, creadorAdmin, email, password, role, ip, device);
                success(req, res, contenido, 201);
            } catch (error) {
                next(error);
            }
        },

        async listadoAdmins(req, res, next) {
            try {
                const adminId = req.admin.id
                const admins = await servicioAdmin.obtenerTodosLosAdmins(baseDeDatos, adminId);
                success(req, res, admins, 200);
            } catch (error) {
            next(error);
            }
        },

        async aprobarDepositos(req, res, next) {
            try {
                const { id } = req.params;
                const adminId = req.admin.id
                const ip = req.ip;

                const contenido = await servicioAdmin.procesarAprobacionDeposits(baseDeDatos, adminId, id, ip);
                success(req, res, contenido, 200);
            } catch (error) {
                next(error);
            }
        },

        async rechazarDepositos(req, res, next) {
            try {
                const { id } = req.params;
                const adminId = req.admin.id
                const { reason } = req.body;
                const ip = req.ip;

                const contenido = await servicioAdmin.procesarRechazoDeposito(baseDeDatos, adminId, id, ip, reason);
                success(req, res, contenido, 200);
            } catch (error) {
                next(error);
            }
        },

        async suspenderAdmin(req, res, next) {
            try {
                const { id } = req.params;
                const adminIdResponsable = req.admin.id
                const ip = req.ip;

                const contenido = await servicioAdmin.suspenderAdministrador(baseDeDatos, adminIdResponsable, id, ip);
                success(req, res, contenido, 200);
            } catch (error) {
                next(error);
            }
        },

        async aprobarRetiros(req, res, next) {
        try {
            const withdrawalId = req.params.id;
            const adminId = req.admin.id
            const ip = req.ip;
            const contenido = await servicioAdmin.aprobarRetiro(baseDeDatos, withdrawalId, adminId, ip);
            success(req, res, contenido, 200);
        } catch (error) {
            next(error);
        }
        },

        async rechazarRetiros(req, res, next) {
            try {
                const withdrawalId = req.params.id;
                const adminId = req.admin.id
                const { reason } = req.body;
                const ip = req.ip;
                const contenido = await servicioAdmin.rechazarRetiro(baseDeDatos, withdrawalId, adminId, ip, reason);
                success(req, res, contenido, 200);
            }catch (error) {
                next(error);
        }
        },

        async suspenderUsuario(req, res, next) {
            try {
                const adminId = req.admin.id

                const { userId: targetUserId, reason } = req.body
                const ip = req.ip;
                const contenido = await servicioAdmin.suspenderUsuario(baseDeDatos, targetUserId, reason, adminId, ip);
                success(req, res, contenido, 200);
            } catch (error) {
                next(error);
            }
        },

        async revisarKyc(req, res, next) {
        try {
            const { id, status, detalles } = req.body;
            const adminId = req.admin.id

            const ip = req.ip;
            const result = await servicioAdmin.procesarKycReview(baseDeDatos, id, adminId, status, detalles, ip);
            success(req, res, result, 200);
        } catch (error) {
        next(error);
        }
        },

        async listarKycs(req, res, next) {
            try {
                const adminId = req.admin.id;
                const status = req.validated?.query?.status || 'PENDING';

                const { limit, offset, page } = req.pagination;

                const result = await servicioAdmin.obtenerKycStatus(baseDeDatos, adminId, status, limit, offset);

                const responseData = {
                    status: result.status,
                    solicitudes: result.solicitudes,
                    pagination: createPaginationMetadata({ totalItems: result.total, page, limit })
                };

            success(req, res, responseData, 200);
            } catch (error) {
            next(error);
            }
        },

        async obtenerDepositos(req, res, next) {
            try {
                const { status } = req.validated.query;
                const adminId = req.admin.id;

                const { limit, offset, page } = req.pagination;

                const result = await servicioAdmin.obtenerDepositosStatus(baseDeDatos, adminId, status, limit, offset);

                const responseData = {
                    status: result.status,
                    deposits: result.deposits,
                    pagination: createPaginationMetadata({ totalItems: result.total, page, limit })
                };
                success(req, res, responseData, 200);
                } catch (error) {
                next(error);
                }
        },

        async obtenerRetiros(req, res, next) {
            try {
                const adminId = req.admin.id;
                const { status } = req.validated.query;

                const { limit, offset, page } = req.pagination;

                const result = await servicioAdmin.obtenerRetirosStatus(baseDeDatos, adminId, status, limit, offset);

                const responseData = {
                    status: result.status,
                    withdrawals: result.withdrawals,
                pagination: createPaginationMetadata({ totalItems: result.total, page, limit })
            };

            success(req, res, responseData, 200);
            } catch (error) {
            next(error);
            }
        },

        async reactivarAdmin(req, res, next) {
            try {
                const adminIdResponsable = req.admin.id;
                const adminIdObjetivo = req.params.id;
                const ip = req.ip;

            const admin = await servicioAdmin.reactivarAdmin(baseDeDatos, adminIdResponsable, adminIdObjetivo, ip);
            success(req, res, admin, 200);
            } catch (error) {
                next(error);
            }
        },

        async obtenerTodosLosUsuariosKyc(req, res, next) {
            try {
                const { limit, offset, page } = req.pagination;

                const result = await servicioAdmin.ObtenerAllUsersKyc(baseDeDatos, limit, offset);

                const responseData = {
                    message: result.message,
                    users: result.users,
                    pagination: createPaginationMetadata({ totalItems: result.total, page, limit })
            };

            success(req, res, responseData, 200);
        } catch (error) {
            next(error);
        }
        },

        async reactivarUsuario(req, res, next) {
            try {
                const adminId = req.admin.id;
                const userId = req.params.id;
                const ip = req.ip;

                const data = await servicioAdmin.reactivarUsuario(baseDeDatos, adminId, userId, ip);
                success(req, res, data, 200);
            } catch (error) {
            next(error);
            }
        },

}
}
