export async function solicitarDeposito(baseDeDatosDeposito, baseDeDatosUsers, settingsService, userId, data) {

    const { amount, referenceNumber, requestId, destinationId } = data;

    const kycPolicies = settingsService.get("kyc_policies");
    const depositRules = settingsService.get("deposits_rules");
    if (!kycPolicies || !depositRules) {
        const error = new Error("No se pudieron verificar las reglas de depósito del sistema.");
        error.statusCode = 500;
        throw error;
    }
    if (kycPolicies.require_kyc_for_deposits === true) {
        const kycStatus = await baseDeDatosUsers.obtenerKycStatus(userId);

        if (kycStatus !== 'APPROVED') {
            const error = new Error("Debes verificar tu identidad (KYC) antes de poder realizar depositos.");
            error.statusCode = 403;
            throw error;
        }
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum < depositRules.min_deposit) {
        const error = new Error(`El monto mínimo para realizar un depósito es de ₡${depositRules.min_deposit}.`);
        error.statusCode = 400;
        throw error;
    }

    const resultadoDeposito = await baseDeDatosDeposito.crearDepositoTransaccional(
        userId,
        amountNum,
        referenceNumber,
        requestId,
        destinationId
    );

    return {
        id: resultadoDeposito.id,
        status: resultadoDeposito.status,
        requestId: requestId
    };
}

function mapDeposit(row) {
    const [whole, decimal = ''] = String(row.amount ?? '0').split('.');
    return {
        id: row.id,
        amount: `${whole}.${decimal.padEnd(2, '0').slice(0, 2)}`,
        referenceNumber: row.reference_number,
        requestId: row.request_id,
        status: row.status,
        destination: row.destination_id ? {
            id: Number(row.destination_id),
            type: row.destination_type,
            destinationValue: row.destination_value,
            accountHolder: row.account_holder,
            version: Number(row.destination_version)
        } : null,
        rejectionReason: row.rejection_reason || null,
        reviewedAt: row.reviewed_at || null,
        createdAt: row.created_at
    };
}

export async function listarDepositos(baseDeDatos, userId, filters, limit, offset) {
    const result = await baseDeDatos.listarDepositosUsuario(userId, filters, limit, offset);
    return { deposits: result.rows.map(mapDeposit), total: result.total };
}

export async function obtenerDeposito(baseDeDatos, userId, depositId) {
    const row = await baseDeDatos.obtenerDepositoUsuario(userId, depositId);
    if (!row) {
        const error = new Error('DEPÓSITO NO ENCONTRADO');
        error.statusCode = 404;
        throw error;
    }
    return mapDeposit(row);
}
