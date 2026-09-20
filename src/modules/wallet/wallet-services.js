export async function consultarBalance(baseDeDatosWallet, userId) {
    const wallet = await baseDeDatosWallet.obtenerWalletPorUserId(userId);
    if (!wallet) {
        const error = new Error("BILLETERA_NO_ENCONTRADA");
        error.statusCode = 404;
        throw error;
    }
    return wallet;
}

export async function consultarTransacciones(baseDeDatosWallet, userId, limit, offset) {
    const { rows, total } = await baseDeDatosWallet.obtenerTransaccionesPorUserId(userId, limit, offset);

    return {
        transacciones: rows,
        total: total
    };
}

function money(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return null;
    return amount.toFixed(2);
}

export async function consultarReglasOperativas(settingsService, depositDestinationDatabase) {
    const depositRules = settingsService?.get("deposits_rules");
    const withdrawRules = settingsService?.get("withdraws_rules");
    const kycPolicies = settingsService?.get("kyc_policies");
    const depositMinimum = money(depositRules?.min_deposit);
    const withdrawalMinimum = money(withdrawRules?.min_withdrawal);

    if (!depositMinimum || !withdrawalMinimum
        || typeof kycPolicies?.require_kyc_for_deposits !== "boolean"
        || typeof kycPolicies?.require_kyc_for_withdrawals !== "boolean") {
        const error = new Error("No se pudieron obtener las reglas operativas.");
        error.statusCode = 500;
        throw error;
    }

    const destinations = await depositDestinationDatabase.obtenerDestinosVigentes();
    return {
        deposit: {
            minimum: depositMinimum,
            requiresKyc: kycPolicies.require_kyc_for_deposits,
            destinations
        },
        withdrawal: {
            minimum: withdrawalMinimum,
            requiresKyc: kycPolicies.require_kyc_for_withdrawals
        }
    };
}
