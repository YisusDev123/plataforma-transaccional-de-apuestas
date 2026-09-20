async function tableExists(connection, table) {
    const [[row]] = await connection.query(`
        SELECT COUNT(*) AS total FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ?
    `, [table]);
    return Number(row.total) > 0;
}

async function columnExists(connection, table, column) {
    const [[row]] = await connection.query(`
        SELECT COUNT(*) AS total FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
    `, [table, column]);
    return Number(row.total) > 0;
}

async function indexColumns(connection, table, indexName) {
    const [rows] = await connection.query(`
        SELECT column_name
        FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
        ORDER BY seq_in_index
    `, [table, indexName]);
    return rows.map((row) => row.column_name);
}

export async function applyDepositDestinationMigration(connection) {
    const actions = [];
    if (!await tableExists(connection, 'deposit_destinations')) {
        await connection.query(`
            CREATE TABLE deposit_destinations (
                id BIGINT NOT NULL AUTO_INCREMENT,
                type ENUM('BANK_ACCOUNT', 'SINPE_MOVIL') NOT NULL,
                destination_value VARCHAR(34) NOT NULL,
                account_holder VARCHAR(255) NOT NULL,
                version BIGINT UNSIGNED NOT NULL,
                created_by_admin_id BIGINT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_deposit_destination_type_version (type, version),
                CONSTRAINT fk_deposit_destination_admin
                    FOREIGN KEY (created_by_admin_id) REFERENCES admins(id)
            ) ENGINE=InnoDB
        `);
        actions.push('create deposit_destinations');
    }

    if (!await tableExists(connection, 'deposit_destination_state')) {
        await connection.query(`
            CREATE TABLE deposit_destination_state (
                type ENUM('BANK_ACCOUNT', 'SINPE_MOVIL') NOT NULL,
                current_destination_id BIGINT NULL,
                version BIGINT UNSIGNED NOT NULL DEFAULT 0,
                updated_at DATETIME NULL,
                PRIMARY KEY (type),
                CONSTRAINT fk_current_deposit_destination
                    FOREIGN KEY (current_destination_id) REFERENCES deposit_destinations(id)
            ) ENGINE=InnoDB
        `);
        actions.push('create deposit_destination_state');
    } else if (!await columnExists(connection, 'deposit_destination_state', 'type')) {
        const [[legacyState]] = await connection.query(
            'SELECT current_destination_id, version FROM deposit_destination_state WHERE id = 1 LIMIT 1'
        );
        let legacyType = null;
        if (legacyState?.current_destination_id) {
            const [[destination]] = await connection.query(
                'SELECT type FROM deposit_destinations WHERE id = ? LIMIT 1',
                [legacyState.current_destination_id]
            );
            legacyType = destination?.type || null;
        }
        await connection.query(`
            CREATE TABLE deposit_destination_state_next (
                type ENUM('BANK_ACCOUNT', 'SINPE_MOVIL') NOT NULL,
                current_destination_id BIGINT NULL,
                version BIGINT UNSIGNED NOT NULL DEFAULT 0,
                updated_at DATETIME NULL,
                PRIMARY KEY (type),
                CONSTRAINT fk_current_deposit_destination_next
                    FOREIGN KEY (current_destination_id) REFERENCES deposit_destinations(id)
            ) ENGINE=InnoDB
        `);
        await connection.query(`
            INSERT INTO deposit_destination_state_next (type, current_destination_id, version)
            VALUES ('BANK_ACCOUNT', NULL, 0), ('SINPE_MOVIL', NULL, 0)
        `);
        if (legacyType) {
            await connection.query(`
                UPDATE deposit_destination_state_next
                SET current_destination_id = ?, version = ?
                WHERE type = ?
            `, [legacyState.current_destination_id, legacyState.version, legacyType]);
        }
        await connection.query('DROP TABLE deposit_destination_state');
        await connection.query('RENAME TABLE deposit_destination_state_next TO deposit_destination_state');
        actions.push('upgrade deposit_destination_state per type');
    }

    const legacyVersionIndex = await indexColumns(
        connection, 'deposit_destinations', 'uq_deposit_destination_version'
    );
    if (legacyVersionIndex.length > 0) {
        await connection.query('ALTER TABLE deposit_destinations DROP INDEX uq_deposit_destination_version');
        actions.push('drop global destination version index');
    }
    const typedVersionIndex = await indexColumns(
        connection, 'deposit_destinations', 'uq_deposit_destination_type_version'
    );
    if (typedVersionIndex.length === 0) {
        await connection.query(`
            ALTER TABLE deposit_destinations
            ADD UNIQUE KEY uq_deposit_destination_type_version (type, version)
        `);
        actions.push('add destination type/version index');
    }

    await connection.query(`
        INSERT INTO deposit_destination_state (type, current_destination_id, version)
        VALUES ('BANK_ACCOUNT', NULL, 0), ('SINPE_MOVIL', NULL, 0)
        ON DUPLICATE KEY UPDATE type = VALUES(type)
    `);

    if (!await columnExists(connection, 'deposits', 'deposit_destination_id')) {
        await connection.query(`
            ALTER TABLE deposits
            ADD COLUMN deposit_destination_id BIGINT NULL AFTER request_id,
            ADD INDEX idx_deposits_destination (deposit_destination_id),
            ADD CONSTRAINT fk_deposits_destination
                FOREIGN KEY (deposit_destination_id) REFERENCES deposit_destinations(id)
        `);
        actions.push('add deposits.deposit_destination_id');
    }
    return { changed: actions.length > 0, actions };
}
