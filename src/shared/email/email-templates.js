function codeMarkup(code) {
    return String(code).split('').map(digit => `<span style="display:inline-block;margin:0 3px;padding:10px 12px;border-radius:10px;background:#17192b;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:1px">${digit}</span>`).join('')
}

function layout({ title, introduction, code, expiration }) {
    return {
        html: `<!doctype html><html lang="es"><body style="margin:0;background:#0b0c18;color:#e9ebf5;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="border:1px solid #292d49;border-radius:20px;background:#111326;padding:28px"><p style="margin:0;color:#35e0a1;font-size:12px;font-weight:800;letter-spacing:2px">Loto Demo</p><h1 style="margin:12px 0 14px;color:#ffffff;font-size:26px">${title}</h1><p style="margin:0 0 24px;color:#c8cde0;line-height:1.6">${introduction}</p><div style="margin:0 0 22px;white-space:nowrap">${codeMarkup(code)}</div><p style="margin:0;color:#aeb4cd;font-size:14px;line-height:1.6">Este código vence en ${expiration}. Si no solicitaste esta acción, ignora este mensaje y no compartas el código.</p></div></div></body></html>`,
        text: `Loto Demo\n\n${title}\n\n${introduction}\n\nCódigo: ${code}\n\nEste código vence en ${expiration}. Si no solicitaste esta acción, ignora este mensaje y no compartas el código.`,
    }
}

export function verificationEmail({ code }) {
    return {
        subject: 'Verifica tu correo en Loto Demo',
        ...layout({
            title: 'Verifica tu correo electrónico',
            introduction: 'Ingresa este código en Loto Demo para confirmar que esta dirección te pertenece.',
            code,
            expiration: '60 minutos',
        }),
    }
}

export function passwordResetEmail({ code }) {
    return {
        subject: 'Código para restablecer tu contraseña',
        ...layout({
            title: 'Restablece tu contraseña',
            introduction: 'Ingresa este código en Loto Demo para crear una nueva contraseña.',
            code,
            expiration: '60 minutos',
        }),
    }
}
