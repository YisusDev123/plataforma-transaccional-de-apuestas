const INDEXES = Object.freeze([
    { table: 'bets', name: 'idx_bets_user_created', columns: ['user_id', 'created_at', 'id'] },
    { table: 'deposits', name: 'idx_deposits_user_created', columns: ['user_id', 'created_at', 'id'] },
    { table: 'withdrawals', name: 'idx_withdrawals_user_created', columns: ['user_id', 'created_at', 'id'] },
    { table: 'wallet_transactions', name: 'idx_wallet_transactions_reference', columns: ['reference_type', 'reference_id', 'type', 'status'] },
    { table: 'user_sessions', name: 'uq_user_sessions_refresh_hash', columns: ['refresh_token_hash'], unique: true },
    { table: 'admin_sessions', name: 'uq_admin_sessions_refresh_hash', columns: ['refresh_token_hash'], unique: true }
]);

async function columnExists(connection, table, column) {
    const [[row]] = await connection.query(`
        SELECT COUNT(*) AS total
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
    `, [table, column]);
    return Number(row.total) > 0;
}

async function readIndexes(connection, table) {
    const [rows] = await connection.query(`
        SELECT index_name AS indexName, non_unique AS nonUnique,
               GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS columns
        FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ?
        GROUP BY index_name, non_unique
    `, [table]);
    return rows;
}

export async function applyFrontendContractsMigration(connection) {
    const actions = [];

    if (!await columnExists(connection, 'deposits', 'rejection_reason')) {
        await connection.query('ALTER TABLE deposits ADD COLUMN rejection_reason VARCHAR(255) NULL AFTER reviewed_at');
        actions.push('deposits.rejection_reason');
    }

    for (const definition of INDEXES) {
        const indexes = await readIndexes(connection, definition.table);
        const expectedColumns = definition.columns.join(',');
        const equivalent = indexes.find(index => index.columns === expectedColumns
            && (!definition.unique || Number(index.nonUnique) === 0));
        if (equivalent) continue;

        const uniqueness = definition.unique ? 'UNIQUE ' : '';
        await connection.query(
            `ALTER TABLE \`${definition.table}\` ADD ${uniqueness}INDEX \`${definition.name}\` (${definition.columns.map(column => `\`${column}\``).join(', ')})`
        );
        actions.push(`${definition.table}.${definition.name}`);
    }

    const betIndexes = await readIndexes(connection, 'bets');
    const duplicateRequestIndexes = betIndexes.filter(index => index.columns === 'request_id' && Number(index.nonUnique) === 0);
    if (duplicateRequestIndexes.length > 1) {
        const removable = duplicateRequestIndexes.find(index => index.indexName === 'uq_request_id');
        if (removable) {
            await connection.query('ALTER TABLE bets DROP INDEX `uq_request_id`');
            actions.push('bets.drop_uq_request_id');
        }
    }

    return { changed: actions.length > 0, actions };
}

export const frontendContractIndexDefinitions = INDEXES;
