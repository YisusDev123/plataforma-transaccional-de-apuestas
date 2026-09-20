export async function withMysqlLock(pool, lockName, operation) {
    const connection = await pool.getConnection();
    let acquired = false;
    try {
        const [[row]] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
        acquired = Number(row.acquired) === 1;
        if (!acquired) return { acquired: false, result: undefined };
        return { acquired: true, result: await operation() };
    } finally {
        if (acquired) {
            await connection.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
        }
        connection.release();
    }
}
