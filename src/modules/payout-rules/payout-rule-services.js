function serialize(rule) {
    return {
        id: Number(rule.id),
        lottery: rule.lottery,
        modality: rule.modality,
        multiplier: Number(rule.multiplier).toFixed(2),
        isActive: Number(rule.is_active) === 1,
        version: Number(rule.version),
        updatedAt: rule.updated_at ?? null
    };
}

export function iniciarPayoutRuleService(payoutRuleSql, settingsService) {
    return {
        async list() {
            return (await payoutRuleSql.list()).map(serialize);
        },

        async update(input) {
            const maxTicketTotal = Number(settingsService.get('financial_rules')?.max_ticket_total);
            const multiplier = Number(input.multiplier);
            if (!Number.isFinite(maxTicketTotal) || maxTicketTotal <= 0) {
                const error = new Error('No se pudo verificar el límite financiero del sistema.');
                error.statusCode = 503;
                error.publicCode = 'BET_RULES_UNAVAILABLE';
                throw error;
            }
            if (maxTicketTotal * multiplier > Number.MAX_SAFE_INTEGER / 100) {
                const error = new Error('El multiplicador excede el máximo seguro para el monto máximo del boleto.');
                error.statusCode = 400;
                error.publicCode = 'PAYOUT_MULTIPLIER_UNSAFE';
                throw error;
            }
            return serialize(await payoutRuleSql.update(input));
        }
    };
}
