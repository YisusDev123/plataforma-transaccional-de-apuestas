async function columnExists(connection, table, column) {
    const [[row]] = await connection.query(`
        SELECT COUNT(*) AS total
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
    `, [table, column]);
    return Number(row.total) > 0;
}

function legacyDataError(total) {
    const error = new Error('La migración se detuvo porque existen snapshots JSON que requieren revisión manual.');
    error.code = 'LEGACY_BET_RECEIPTS_PRESENT';
    error.total = total;
    return error;
}

export async function applyBetReceiptsMigration(connection) {
    const actions = [];

    if (!await columnExists(connection, 'bets', 'customer_name_snapshot')) {
        await connection.query(`
            ALTER TABLE bets
            ADD COLUMN customer_name_snapshot VARCHAR(255) NULL AFTER request_id
        `);
        actions.push('add bets.customer_name_snapshot');
    }

    const hasReceiptSnapshot = await columnExists(connection, 'bets', 'receipt_snapshot');
    const hasReceiptVersion = await columnExists(connection, 'bets', 'receipt_version');

    if (hasReceiptSnapshot) {
        const [[row]] = await connection.query(`
            SELECT COUNT(*) AS total
            FROM bets
            WHERE receipt_snapshot IS NOT NULL
        `);
        const total = Number(row.total);
        if (total > 0) throw legacyDataError(total);
    }

    if (hasReceiptVersion) {
        await connection.query('ALTER TABLE bets DROP COLUMN receipt_version');
        actions.push('drop bets.receipt_version');
    }

    if (hasReceiptSnapshot) {
        await connection.query('ALTER TABLE bets DROP COLUMN receipt_snapshot');
        actions.push('drop bets.receipt_snapshot');
    }

    return { changed: actions.length > 0, actions };
}
