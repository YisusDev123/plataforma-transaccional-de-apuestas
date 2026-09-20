const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F]/g;

export function normalizeDevice(value, { fallback = 'unknown', max = 255 } = {}) {
    if (typeof value !== 'string') return fallback;

    const normalized = value
        .normalize('NFC')
        .replace(CONTROL_CHARACTERS, '')
        .replace(/[<>]/g, '')
        .trim();

    if (normalized === '') return fallback;
    return Array.from(normalized).slice(0, max).join('');
}

export function getRequestDevice(req) {
    return normalizeDevice(req.headers?.['user-agent']);
}
