import config from '../../config.js';
import { closeDb, pool } from '../config/pool.js';
import { applyDrawDefaultsMigration } from '../shared/database/draw-defaults-migration.js';

if (process.env.ALLOW_DB_MIGRATION !== 'true') {
    console.error('[MIGRATION BLOCKED] Define ALLOW_DB_MIGRATION=true para autorizar el cambio de draw_defaults.');
    process.exitCode = 1;
} else {
    const closeMinutes = Number(process.env.AUTO_CLOSE_MINUTES_BEFORE || 10);
    const connection = await pool.getConnection();
    try {
        const result = await applyDrawDefaultsMigration(connection, closeMinutes);
        console.log(JSON.stringify({ database: config.mysql.database, ...result }, null, 2));
    } catch (error) {
        console.error(`[MIGRATION ERROR] ${error?.publicCode || error?.code || error?.name || 'MIGRATION_FAILURE'}`);
        process.exitCode = 1;
    } finally {
        connection.release();
        await closeDb().catch(() => {});
    }
}
