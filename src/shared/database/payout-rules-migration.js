async function columnExists(connection, table, column) {
    const [[row]] = await connection.query(`
        SELECT COUNT(*) AS total
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
    `, [table, column]);
    return Number(row.total) > 0;
}

export async function applyPayoutRulesMigration(connection) {
    const actions = [];
    if (!await columnExists(connection, 'payout_rules', 'version')) {
        await connection.query(`
            ALTER TABLE payout_rules
            ADD COLUMN version BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER is_active
        `);
        actions.push('payout_rules.version');
    }
    return { changed: actions.length > 0, actions };
}
