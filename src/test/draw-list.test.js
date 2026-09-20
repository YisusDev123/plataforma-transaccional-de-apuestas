import { describe, expect, test, jest } from '@jest/globals';
import { listAdminDrawListService } from '../modules/draw/draw-service.js';

function drawRow(overrides = {}) {
    return {
        id: 12,
        lottery: 'TICA',
        modality: 'MEGA_REVENTADO',
        draw_date: '2026-09-09',
        schedule_time: '19:30:00',
        status: 'PAID',
        result_number: '07',
        winning_number: '07',
        processed_status: 'COMPLETED',
        total_sold: '1500.00',
        total_refunded: '0.00',
        total_amount_paid: '1200.00',
        numbers: Array.from({ length: 100 }, (_, index) => ({
            number_played: String(index).padStart(2, '0'),
            sold_amount: index === 7 ? '100.00' : '0.00',
            bet_count: index === 7 ? 2 : 0,
            max_amount: '500.00'
        })),
        ...overrides
    };
}

describe('lista administrativa de sorteos', () => {
    test('mapea ventas por número y totales como strings', async () => {
        const drawSql = { listAdminDrawList: jest.fn().mockResolvedValue({ draws: [drawRow()], total: 1 }) };

        const result = await listAdminDrawListService(drawSql, {
            view: 'TODAY', page: 1, limit: 10, offset: 0
        });

        expect(drawSql.listAdminDrawList).toHaveBeenCalledWith(expect.objectContaining({ view: 'TODAY', businessDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
        expect(result.draws[0]).toEqual(expect.objectContaining({
            draw_id: 12,
            winning_number: '07',
            total_sold: '1500.00',
            total_paid: '1200.00'
        }));
        expect(result.draws[0].numbers).toHaveLength(100);
        expect(result.draws[0].numbers[7]).toEqual(expect.objectContaining({ number: '07', sold_amount: '100.00', bet_count: 2 }));
    });

    test('rechaza rangos de fecha invertidos', async () => {
        const drawSql = { listAdminDrawList: jest.fn() };
        await expect(listAdminDrawListService(drawSql, {
            view: 'HISTORY', date_from: '2026-09-10', date_to: '2026-09-09', page: 1, limit: 10, offset: 0
        })).rejects.toMatchObject({ statusCode: 400, publicCode: 'INVALID_DATE_RANGE' });
        expect(drawSql.listAdminDrawList).not.toHaveBeenCalled();
    });

});
