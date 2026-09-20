import config from '../../config.js';
import { closeDb, pool } from '../config/pool.js';
import { applyFrontendContractsMigration } from '../shared/database/frontend-contracts-migration.js';

if (process.env.ALLOW_DB_MIGRATION !== 'true') {
    console.error('[MIGRATION BLOCKED] Define ALLOW_DB_MIGRATION=true para autorizar cambios de esquema.');
    process.exitCode = 1;
} else {
    const connection = await pool.getConnection();
    try {
        const result = await applyFrontendContractsMigration(connection);
        console.log(JSON.stringify({ database: config.mysql.database, ...result }, null, 2));
    } catch (error) {
        console.error(`[MIGRATION ERROR] ${error?.code || error?.name || 'MIGRATION_FAILURE'}`);
        process.exitCode = 1;
    } finally {
        connection.release();
        await closeDb().catch(() => {});
    }
}
