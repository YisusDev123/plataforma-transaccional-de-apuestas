import config from '../../../config.js';

export const USER_REFRESH_COOKIE = 'lottery_user_refresh';
export const ADMIN_REFRESH_COOKIE = 'lottery_admin_refresh';
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function readCookie(req, name) {
    const header = req.headers.cookie;
    if (typeof header !== 'string') return undefined;
    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
        try {
            return decodeURIComponent(part.slice(separator + 1).trim());
        } catch {
            return undefined;
        }
    }
    return undefined;
}

function cookieOptions(path) {
    return {
        httpOnly: true,
        secure: config.app.environment === 'production',
        sameSite: 'lax',
        path,
        maxAge: REFRESH_MAX_AGE_MS
    };
}

export function setRefreshCookie(res, name, token, path) {
    res.cookie(name, token, cookieOptions(path));
}

export function clearRefreshCookie(res, name, path) {
    const { maxAge: _maxAge, ...options } = cookieOptions(path);
    res.clearCookie(name, options);
}
