import {
    REQUIRED_COLUMNS,
    REQUIRED_QUERY_INDEXES,
    REQUIRED_SETTINGS,
    REQUIRED_TABLES,
    REQUIRED_UNIQUE_INDEXES
} from './database-contract.js';

function check(name, passed, detail) {
    return { name, passed, detail };
}

export async function runProductionCheck({ pool, config }) {
    const checks = [];
    const warnings = [];

    const [[clock]] = await pool.query(`
        SELECT @@session.time_zone AS sessionTimeZone,
               @@session.innodb_lock_wait_timeout AS lockWaitTimeoutSeconds,
               @@session.max_execution_time AS maxExecutionTimeMs
    `);
    checks.push(check('mysql_utc', clock.sessionTimeZone === '+00:00', clock.sessionTimeZone === '+00:00' ? 'UTC' : 'INVALID'));
    const sessionTimeoutsMatch = Number(clock.lockWaitTimeoutSeconds) === config.mysql.lockWaitTimeoutSeconds
        && Number(clock.maxExecutionTimeMs) === config.mysql.queryTimeoutMs;
    checks.push(check(
        'mysql_session_timeouts',
        sessionTimeoutsMatch,
        `${clock.lockWaitTimeoutSeconds}/${clock.maxExecutionTimeMs}`
    ));

    const [tables] = await pool.query(`
        SELECT table_name AS tableName
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
    `);
    const presentTables = new Set(tables.map(row => row.tableName));
    const missingTables = REQUIRED_TABLES.filter(table => !presentTables.has(table));
    checks.push(check('required_tables', missingTables.length === 0, missingTables.length ? missingTables.join(',') : `${REQUIRED_TABLES.length}/${REQUIRED_TABLES.length}`));

    const [columns] = await pool.query(`
        SELECT CONCAT(table_name, '.', column_name) AS columnName
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
    `);
    const presentColumns = new Set(columns.map(row => row.columnName));
    const missingColumns = REQUIRED_COLUMNS.filter(column => !presentColumns.has(column));
    checks.push(check('critical_columns', missingColumns.length === 0, missingColumns.length ? missingColumns.join(',') : `${REQUIRED_COLUMNS.length}/${REQUIRED_COLUMNS.length}`));

    const [authCodeColumns] = await pool.query(`
        SELECT table_name AS tableName, column_name AS columnName,
               character_maximum_length AS maximumLength
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND ((table_name = 'email_verifications' AND column_name = 'verification_code')
            OR (table_name = 'password_resets' AND column_name = 'reset_code'))
    `);
    const authCodeLengths = new Map(authCodeColumns.map(row => [`${row.tableName}.${row.columnName}`, Number(row.maximumLength)]));
    const authCodesProtected = authCodeLengths.get('email_verifications.verification_code') >= 64
        && authCodeLengths.get('password_resets.reset_code') >= 64;
    checks.push(check('auth_code_storage', authCodesProtected, authCodesProtected ? 'hashed' : 'MIGRATION_REQUIRED'));

    const [indexes] = await pool.query(`
        SELECT table_name AS tableName,
               non_unique AS nonUnique,
               GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',') AS columns
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
        GROUP BY table_name, index_name, non_unique
    `);
    const uniqueIndexes = new Set(indexes
        .filter(row => Number(row.nonUnique) === 0)
        .map(row => `${row.tableName}:${row.columns}`));
    const missingIndexes = REQUIRED_UNIQUE_INDEXES
        .filter(([table, indexColumns]) => !uniqueIndexes.has(`${table}:${indexColumns}`))
        .map(([table, indexColumns]) => `${table}(${indexColumns})`);
    checks.push(check('critical_unique_indexes', missingIndexes.length === 0, missingIndexes.length ? missingIndexes.join(',') : `${REQUIRED_UNIQUE_INDEXES.length}/${REQUIRED_UNIQUE_INDEXES.length}`));

    const allIndexes = new Set(indexes.map(row => `${row.tableName}:${row.columns}`));
    const missingQueryIndexes = REQUIRED_QUERY_INDEXES
        .filter(([table, indexColumns]) => !allIndexes.has(`${table}:${indexColumns}`))
        .map(([table, indexColumns]) => `${table}(${indexColumns})`);
    checks.push(check('critical_query_indexes', missingQueryIndexes.length === 0, missingQueryIndexes.length ? missingQueryIndexes.join(',') : `${REQUIRED_QUERY_INDEXES.length}/${REQUIRED_QUERY_INDEXES.length}`));

    const [settingRows] = await pool.query('SELECT setting_key, setting_value FROM settings');
    const settings = new Map(settingRows.map(row => [row.setting_key, row.setting_value]));
    const invalidSettings = REQUIRED_SETTINGS.filter(key => {
        if (!settings.has(key)) return true;
        try {
            const parsed = typeof settings.get(key) === 'string'
                ? JSON.parse(settings.get(key))
                : settings.get(key);
            return !parsed || Array.isArray(parsed) || typeof parsed !== 'object';
        } catch {
            return true;
        }
    });
    checks.push(check('global_settings', invalidSettings.length === 0, invalidSettings.length ? invalidSettings.join(',') : `${REQUIRED_SETTINGS.length}/${REQUIRED_SETTINGS.length}`));
    const closeMinutes = (() => {
        try {
            const drawDefaultsValue = settings.get('draw_defaults');
            const drawDefaults = typeof drawDefaultsValue === 'string'
                ? JSON.parse(drawDefaultsValue)
                : drawDefaultsValue;
            return Number(drawDefaults?.auto_close_minutes_before);
        } catch {
            return null;
        }
    })();
    const validCloseWindow = Number.isInteger(closeMinutes) && closeMinutes >= 10 && closeMinutes <= 20;
    checks.push(check('draw_close_window', validCloseWindow, validCloseWindow ? `${closeMinutes} minutes` : 'INVALID'));
    if (validCloseWindow) {
        const [[pendingCloseRows]] = await pool.query(`
            SELECT COUNT(*) AS invalidPendingClose
            FROM draws
            WHERE status = 'PENDING'
              AND close_at <> DATE_SUB(
                  DATE_ADD(TIMESTAMP(draw_date, schedule_time), INTERVAL 6 HOUR),
                  INTERVAL ? MINUTE
              )
        `, [closeMinutes]);
        const invalidPendingClose = Number(pendingCloseRows.invalidPendingClose);
        checks.push(check('pending_draw_close_window', invalidPendingClose === 0, String(invalidPendingClose)));
    }

    const connection = await pool.getConnection();
    try {
        const lockName = `lottery:production-check:${process.pid}`;
        const [[acquired]] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
        const lockOk = Number(acquired.acquired) === 1;
        checks.push(check('advisory_locks', lockOk, lockOk ? 'available' : 'unavailable'));
        if (lockOk) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
    } finally {
        connection.release();
    }

    const [grantRows] = await pool.query('SHOW GRANTS');
    const grants = grantRows.flatMap(row => Object.values(row)).join(' ').toUpperCase();
    const dangerousPrivileges = ['ALL PRIVILEGES', 'GRANT OPTION', 'FILE', 'SHUTDOWN', 'CREATE USER', 'SYSTEM_USER']
        .filter(privilege => grants.includes(privilege));
    if (dangerousPrivileges.length > 0) warnings.push({
        name: 'mysql_privileges',
        detail: `Privilegios amplios detectados: ${dangerousPrivileges.join(', ')}`
    });
    if (config.app.environment === 'production') {
        checks.push(check('least_privilege', dangerousPrivileges.length === 0, dangerousPrivileges.length ? 'excessive' : 'restricted'));
    }

    checks.push(check('pool_limits',
        config.mysql.connectionLimit >= (config.app.processRole === 'api' ? 2 : 3)
            && config.mysql.queueLimit >= 1
            && config.mysql.acquireTimeoutMs >= 100
            && config.mysql.queryTimeoutMs >= 1000
            && config.mysql.lockWaitTimeoutSeconds >= 1,
        `${config.mysql.connectionLimit}/${config.mysql.queueLimit}/${config.mysql.acquireTimeoutMs}/${config.mysql.queryTimeoutMs}/${config.mysql.lockWaitTimeoutSeconds}`
    ));

    return {
        success: checks.every(item => item.passed),
        release: config.app.release,
        environment: config.app.environment,
        checks,
        warnings
    };
}
