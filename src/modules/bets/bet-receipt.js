import { decimalToScaledInteger } from '../../shared/utils/decimal-money.js';

export const BET_RECEIPT_ISSUER = 'Loto Demo';

export function money(value) {
    const cents = decimalToScaledInteger(value, 2);
    const whole = cents / 100n;
    const fraction = String(cents % 100n).padStart(2, '0');
    return `${whole}.${fraction}`;
}

function utcIso(value) {
    const text = String(value);
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
        ? `${text.replace(' ', 'T')}Z`
        : text;
    return new Date(normalized).toISOString();
}

export function createBetReceiptData({ acceptedAt, customerName, items, ticketCode, totalAmount }) {
    if (!customerName || !String(customerName).trim()) {
        const error = new Error('El comprobante no está disponible para este ticket histórico.');
        error.statusCode = 404;
        error.publicCode = 'BET_RECEIPT_NOT_AVAILABLE';
        throw error;
    }

    if (!Array.isArray(items) || items.length === 0) {
        const error = new Error('No se encontraron jugadas para generar el comprobante.');
        error.statusCode = 503;
        error.publicCode = 'BET_RECEIPT_DATA_UNAVAILABLE';
        throw error;
    }

    return {
        issuer: { displayName: BET_RECEIPT_ISSUER },
        ticketCode: String(ticketCode),
        acceptedAt: utcIso(acceptedAt),
        timezone: 'America/Costa_Rica',
        currency: 'CRC',
        customer: { fullName: String(customerName).normalize('NFC') },
        totalAmount: money(totalAmount),
        items: items.map(item => ({
            drawId: Number(item.drawId),
            lottery: String(item.lottery),
            modality: String(item.modality),
            drawDate: String(item.drawDate).slice(0, 10),
            scheduleTime: String(item.scheduleTime).slice(0, 8),
            numberPlayed: String(item.numberPlayed).padStart(2, '0'),
            amount: money(item.amount),
            multiplier: money(item.multiplier)
        }))
    };
}
