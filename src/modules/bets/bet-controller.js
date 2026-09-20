import { success } from "../../shared/utils/response.js";
import { createPaginationMetadata } from "../../shared/utils/pagination.js";
import { renderBetReceiptPdf } from './bet-receipt-pdf.js';

function sendReceipt(res, ticketCode, pdf) {
    const safeCode = String(ticketCode).replace(/[^A-Z0-9-]/gi, '');
    res.status(200)
        .set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="comprobante-${safeCode}.pdf"`,
            'Cache-Control': 'private, no-store, max-age=0',
            Pragma: 'no-cache',
            'X-Content-Type-Options': 'nosniff'
        })
        .send(pdf);
}

export function iniciarBetController(servicioBet, betSql, settingsService, limitSql, receiptRenderer = renderBetReceiptPdf) {
    return {
        async createBet(req, res, next) {
            try {
                const userId = req.userId
                const { request_id, bets } = req.body;

                const result = await servicioBet.createBetService(betSql, settingsService, limitSql, userId, request_id, bets);
                success(req, res, result, 200)

            } catch (error) {
                next(error);
            }
        },

        async history(req, res, next) {
            try {
                const { status, requestId, ticketCode } = req.validated.query;
                const { page, limit, offset } = req.pagination;
                const result = await servicioBet.listBetHistory(
                    betSql, req.userId, { status, requestId, ticketCode }, limit, offset
                );
                success(req, res, {
                    tickets: result.tickets,
                    pagination: createPaginationMetadata({ totalItems: result.total, page, limit })
                }, 200);
            } catch (error) {
                next(error);
            }
        },

        async detail(req, res, next) {
            try {
                const result = await servicioBet.getBetDetail(betSql, req.userId, req.params.id);
                success(req, res, result, 200);
            } catch (error) {
                next(error);
            }
        },

        async receipt(req, res, next) {
            try {
                const result = await servicioBet.getUserBetReceipt(betSql, req.userId, req.validated.params.id);
                sendReceipt(res, result.ticketCode, await receiptRenderer(result.receipt));
            } catch (error) {
                next(error);
            }
        },

        async adminHistory(req, res, next) {
            try {
                const { status, ticketCode, dateFrom, dateTo } = req.validated.query;
                const { page, limit, offset } = req.pagination;
                const result = await servicioBet.listAdminBets(
                    betSql, { status, ticketCode, dateFrom, dateTo }, limit, offset
                );
                success(req, res, {
                    tickets: result.tickets,
                    pagination: createPaginationMetadata({ totalItems: result.total, page, limit })
                }, 200);
            } catch (error) {
                next(error);
            }
        },

        async adminDetail(req, res, next) {
            try {
                success(req, res, await servicioBet.getAdminBetDetail(betSql, req.validated.params.id), 200);
            } catch (error) {
                next(error);
            }
        },

        async adminReceipt(req, res, next) {
            try {
                const result = await servicioBet.getAdminBetReceipt(betSql, req.validated.params.id);
                sendReceipt(res, result.ticketCode, await receiptRenderer(result.receipt));
            } catch (error) {
                next(error);
            }
        }
    };
}
