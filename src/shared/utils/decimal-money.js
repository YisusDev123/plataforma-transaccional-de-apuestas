export function decimalToScaledInteger(value, scale = 2) {
    const raw = String(value ?? '');
    const pattern = new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`);
    if (!pattern.test(raw)) throw new TypeError('Valor decimal inválido.');
    const [integerPart, fractionPart = ''] = raw.split('.');
    return BigInt(integerPart) * (10n ** BigInt(scale))
        + BigInt(fractionPart.padEnd(scale, '0'));
}

export function calculatePayoutCents(amount, multiplier) {
    const amountCents = decimalToScaledInteger(amount, 2);
    const multiplierHundredths = decimalToScaledInteger(multiplier, 2);
    const payoutCents = (amountCents * multiplierHundredths + 50n) / 100n;
    if (payoutCents > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new RangeError('El premio excede el rango monetario seguro.');
    }
    return Number(payoutCents);
}
