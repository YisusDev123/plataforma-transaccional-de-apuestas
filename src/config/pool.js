import mysql from "mysql2/promise";
import config from "./../../config.js";
import { createPoolMetrics } from '../shared/observability/pool-metrics.js';
import { configureTimedPool } from './mysql-timeouts.js';

export const poolMetrics = createPoolMetrics();

export const pool = mysql.createPool({
    host: config.mysql.host,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    waitForConnections: true,
    connectionLimit: config.mysql.connectionLimit,
    queueLimit: config.mysql.queueLimit,
    namedPlaceholders: true,
    timezone: "+00:00",
    dateStrings: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

pool.on('connection', (connection) => {
    poolMetrics.onConnection();
    connection.query({
        sql: 'SET SESSION time_zone = "+00:00", innodb_lock_wait_timeout = ?, max_execution_time = ?',
        timeout: config.mysql.queryTimeoutMs,
        values: [config.mysql.lockWaitTimeoutSeconds, config.mysql.queryTimeoutMs]
    }, (error) => {
        if (error) {
            console.error("[MYSQL SESSION ERROR] No se pudo configurar la conexión de forma segura.");
            connection.destroy();
        }
    });
});

const corePool = pool.pool;
poolMetrics.attach(corePool);
const originalGetConnection = corePool.getConnection.bind(corePool);
corePool.getConnection = callback => {
    const hadNoFreeConnection = corePool._freeConnections.length === 0;
    const atConnectionLimit = corePool._allConnections.length >= config.mysql.connectionLimit;
    const wasQueued = hadNoFreeConnection && atConnectionLimit;
    const startedAt = process.hrtime.bigint();
    let settled = false;
    const timeout = setTimeout(() => {
        settled = true;
        const error = new Error('Pool acquisition timeout.');
        error.code = 'POOL_ACQUIRE_TIMEOUT';
        const waitMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        poolMetrics.onAcquisitionResult({ error, wasQueued, waitMs });
        callback(error);
    }, config.mysql.acquireTimeoutMs);
    timeout.unref?.();

    originalGetConnection((error, connection) => {
        if (settled) {
            connection?.release();
            return;
        }
        settled = true;
        clearTimeout(timeout);
        const waitMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        poolMetrics.onAcquisitionResult({ error, wasQueued, waitMs });
        callback(error, connection);
    });
    poolMetrics.onRequestSubmitted();
};

configureTimedPool(pool, config.mysql.queryTimeoutMs);

export async function initDb() {
    try {
        await pool.query("SELECT 1");

        console.log("[BOOT] Conexión MySQL verificada.");
    } catch (err) {
        const error = new Error("No se pudo inicializar la conexión MySQL.");
        error.name = 'DatabaseInitializationError';
        error.code = 'DATABASE_UNAVAILABLE';
        throw error;
    }
}

export async function closeDb() {
    await pool.end();
}
