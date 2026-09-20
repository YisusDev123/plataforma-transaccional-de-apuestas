import { describe, expect, test } from '@jest/globals';
import { sanitizeBody } from '../shared/utils/omitir.js';

describe('sanitizeBody', () => {
    test('oculta secretos en cualquier nivel sin modificar el objeto original', () => {
        const body = {
            email: 'usuario@example.com',
            refreshToken: 'secreto-1',
            nested: {
                password: 'secreto-2',
                items: [{ access_token: 'secreto-3', visible: true }]
            }
        };

        const sanitized = sanitizeBody(body);

        expect(sanitized).toEqual({
            email: 'usuario@example.com',
            refreshToken: '[REDACTED]',
            nested: {
                password: '[REDACTED]',
                items: [{ access_token: '[REDACTED]', visible: true }]
            }
        });
        expect(body.refreshToken).toBe('secreto-1');
    });
});
