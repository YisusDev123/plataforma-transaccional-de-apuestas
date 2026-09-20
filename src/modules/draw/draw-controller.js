import { success } from "../../shared/utils/response.js";
import { createPaginationMetadata } from "../../shared/utils/pagination.js";
import { getRequestDevice } from "../../shared/utils/request-metadata.js";

export function iniciarDrawController(drawService, pool, drawSql, limitsAPI, settingsService, cancelDrawService, eventBus) {
    return {
        async listOpenDraws(req, res, next) {
            try {
                const result = await drawService.listOpenDrawsService(drawSql, settingsService);
                success(req, res, result, 200);
            } catch (error) {
                next(error);
            }
        },

        async getDrawAvailability(req, res, next) {
            try {
                const drawId = req.validated?.params?.id ?? req.params.id;
                const result = await drawService.getDrawAvailabilityService(drawSql, settingsService, drawId);
                success(req, res, result, 200);
            } catch (error) {
                next(error);
            }
        },

        async listAdminDraws(req, res, next) {
            try {
                const { status } = req.validated.query;
                const { page, limit, offset } = req.pagination;
                const result = await drawService.listAdminDrawsService(drawSql, status, limit, offset);
                success(req, res, {
                    status: result.status,
                    draws: result.draws,
                    pagination: createPaginationMetadata({ totalItems: result.total, page, limit })
                }, 200);
            } catch (error) {
                next(error);
            }
        },

        async listAdminDrawList(req, res, next) {
            try {
                const { page, limit, offset } = req.pagination;
                const result = await drawService.listAdminDrawListService(drawSql, { ...req.validated.query, limit, offset });
                success(req, res, {
                    view: result.view,
                    business_date: result.business_date,
                    draws: result.draws,
                    pagination: createPaginationMetadata({ totalItems: result.total, page, limit })
                }, 200);
            } catch (error) {
                next(error);
            }
        },

        async getAdminDrawLimits(req, res, next) {
            try {
                const drawId = req.validated?.params?.id ?? req.params.id;
                const result = await drawService.getAdminDrawLimitsService(drawSql, drawId);
                success(req, res, result, 200);
            } catch (error) {
                next(error);
            }
        },

        async loadResults(req, res, next) {
            try {
                const adminId = req.admin.id;
                const { results } = req.body;

                const ip = req.ip;
                const device = getRequestDevice(req);

                const result = await drawService.loadResultsService(drawSql, eventBus, adminId, results, ip, device);
                success(req, res, result, 200);

            } catch (error) {
                next(error);
            }
        },

        async cancelDraw(req, res, next) {
            try {
                const drawId = req.params.id;
                const result = await cancelDrawService.executeCancel(drawId);
                success(req, res, result, 200);
            } catch (error) {
                next(error);
            }
        }
    };
}
