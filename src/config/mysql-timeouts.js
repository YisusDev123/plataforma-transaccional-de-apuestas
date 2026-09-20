const DECORATED_CONNECTION = Symbol('lottery.mysql.timedConnection');
const UNUSABLE_CONNECTION = Symbol('lottery.mysql.unusableConnection');

const TIMEOUT_CODES = new Set([
    'PROTOCOL_SEQUENCE_TIMEOUT',
    'ER_LOCK_WAIT_TIMEOUT',
    'ER_QUERY_TIMEOUT',
    'ER_MAX_EXECUTION_TIME_EXCEEDED'
]);

function queryOptions(sql, timeoutMs) {
    if (typeof sql === 'string') return { sql, timeout: timeoutMs };
    if (!sql || typeof sql !== 'object') return sql;

    const requestedTimeout = Number(sql.timeout);
    return {
        ...sql,
        timeout: Number.isFinite(requestedTimeout) && requestedTimeout > 0
            ? Math.min(requestedTimeout, timeoutMs)
            : timeoutMs
    };
}

function isDatabaseTimeout(error) {
    return TIMEOUT_CODES.has(error?.code) || Number(error?.errno) === 1205 || Number(error?.errno) === 3024;
}

function databaseTimeoutError(phase) {
    const error = new Error('La base de datos tardó demasiado en responder. Consulta el estado antes de reintentar.');
    error.name = 'DatabaseTimeoutError';
    error.code = 'DATABASE_QUERY_TIMEOUT';
    error.statusCode = 503;
    error.publicCode = 'SERVICE_BUSY';
    error.outcomeUnknown = phase === 'commit';
    return error;
}

function discardConnection(connection) {
    connection[UNUSABLE_CONNECTION] = true;
    try {
        connection.destroy();
    } catch {
        return;
    }
}

export function decorateTimedConnection(connection, queryTimeoutMs) {
    if (connection[DECORATED_CONNECTION]) return connection;

    const rawQuery = connection.query.bind(connection);
    const rawExecute = connection.execute.bind(connection);

    const run = async (executor, sql, params, phase = 'query') => {
        if (connection[UNUSABLE_CONNECTION]) throw databaseTimeoutError(phase);
        try {
            return await executor(queryOptions(sql, queryTimeoutMs), params);
        } catch (error) {
            if (!isDatabaseTimeout(error)) throw error;
            discardConnection(connection);
            throw databaseTimeoutError(phase);
        }
    };

    connection.query = (sql, params) => run(rawQuery, sql, params);
    connection.execute = (sql, params) => run(rawExecute, sql, params);
    connection.beginTransaction = () => run(rawQuery, 'START TRANSACTION', undefined, 'begin');
    connection.commit = () => run(rawQuery, 'COMMIT', undefined, 'commit');
    connection.rollback = () => connection[UNUSABLE_CONNECTION]
        ? Promise.resolve()
        : run(rawQuery, 'ROLLBACK', undefined, 'rollback');
    connection[DECORATED_CONNECTION] = true;
    return connection;
}

export function configureTimedPool(pool, queryTimeoutMs) {
    const rawGetConnection = pool.getConnection.bind(pool);

    pool.getConnection = async () => decorateTimedConnection(await rawGetConnection(), queryTimeoutMs);

    pool.query = async (sql, params) => {
        const connection = await pool.getConnection();
        try {
            return await connection.query(sql, params);
        } finally {
            connection.release();
        }
    };

    pool.execute = async (sql, params) => {
        const connection = await pool.getConnection();
        try {
            return await connection.execute(sql, params);
        } finally {
            connection.release();
        }
    };

    return pool;
}
