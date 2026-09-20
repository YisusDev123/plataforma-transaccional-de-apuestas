export async function solicitarRetiro(baseDeDatosWithdrawals, baseDeDatosUsers, settingsService, userId, data) {
    const { amount, destinationAccount, destinationAccountHolder, requestId } = data;

    const kycPolicies = settingsService.get("kyc_policies");
    const withdrawRules = settingsService.get("withdraws_rules");

    if (!kycPolicies || !withdrawRules) {
        const error = new Error("No se pudieron verificar las reglas de retiro del sistema.");
        error.statusCode = 500;
        throw error;
    }

    if (kycPolicies.require_kyc_for_withdrawals === true) {
        const kycStatus = await baseDeDatosUsers.obtenerKycStatus(userId);

        if (kycStatus !== 'APPROVED') {
            const error = new Error("Debes verificar tu identidad (KYC) antes de poder realizar retiros.");
            error.statusCode = 403;
            throw error;
        }
    }

    if (amount < withdrawRules.min_withdrawal) {
        const error = new Error(`El monto mínimo para realizar un retiro es de ₡${withdrawRules.min_withdrawal}.`);
        error.statusCode = 400;
        throw error;
    }

    const resultadoRetiro = await baseDeDatosWithdrawals.crearRetiroTransaccional(
        userId,
        String(amount),
        destinationAccount,
        destinationAccountHolder,
        requestId
    );

    return {
        id: resultadoRetiro.id,
        status: resultadoRetiro.status,
        amount,
        destinationAccount: maskAccount(destinationAccount),
        destinationAccountHolder,
        requestId
    };
}

function money(value) {
    const normalized = String(value ?? '0');
    const [whole, decimal = ''] = normalized.split('.');
    return `${whole}.${decimal.padEnd(2, '0').slice(0, 2)}`;
}

function accountFromSnapshot(snapshot) {
    if (!snapshot) return '';
    if (typeof snapshot === 'object') return snapshot.cuenta || '';
    try {
        return JSON.parse(snapshot)?.cuenta || '';
    } catch {
        return '';
    }
}

function accountHolderFromSnapshot(snapshot) {
    if (!snapshot) return null;
    if (typeof snapshot === 'object') return snapshot.titular || null;
    try {
        return JSON.parse(snapshot)?.titular || null;
    } catch {
        return null;
    }
}

export function maskAccount(account) {
    const value = String(account || '');
    if (value.length <= 4) return '*'.repeat(value.length);
    return `${'*'.repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}

function mapWithdrawal(row) {
    return {
        id: row.id,
        amount: money(row.amount),
        requestId: row.request_id,
        destinationAccount: maskAccount(accountFromSnapshot(row.withdrawal_account_snapshot)),
        destinationAccountHolder: accountHolderFromSnapshot(row.withdrawal_account_snapshot),
        status: row.status,
        rejectionReason: row.rejection_reason || null,
        reviewedAt: row.reviewed_at || null,
        processedAt: row.processed_at || null,
        createdAt: row.created_at
    };
}

export async function listarRetiros(baseDeDatos, userId, filters, limit, offset) {
    const result = await baseDeDatos.listarRetirosUsuario(userId, filters, limit, offset);
    return { withdrawals: result.rows.map(mapWithdrawal), total: result.total };
}

export async function obtenerRetiro(baseDeDatos, userId, withdrawalId) {
    const row = await baseDeDatos.obtenerRetiroUsuario(userId, withdrawalId);
    if (!row) {
        const error = new Error('RETIRO NO ENCONTRADO');
        error.statusCode = 404;
        throw error;
    }
    return mapWithdrawal(row);
}
