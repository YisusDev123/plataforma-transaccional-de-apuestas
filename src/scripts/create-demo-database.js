import 'dotenv/config';
import mysql from 'mysql2/promise';

const DEMO_DATABASE = 'lottery_demo';

function quoteIdentifier(value) {
    return `\`${String(value).replaceAll('`', '``')}\``;
}

function requireSafeEnvironment() {
    const sourceDatabase = String(process.env.MYSQL_DB || '').trim();
    const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();

    if (process.env.ALLOW_DEMO_DB_CREATE !== 'true') {
        throw new Error('Falta ALLOW_DEMO_DB_CREATE=true');
    }
    if (nodeEnv !== 'development') {
        throw new Error('La base demo sólo puede prepararse con NODE_ENV=development');
    }
    if (!sourceDatabase || sourceDatabase === DEMO_DATABASE || /prod(uction)?/i.test(sourceDatabase)) {
        throw new Error('MYSQL_DB no identifica una base de desarrollo segura');
    }

    return sourceDatabase;
}

async function countRows(connection, database, table) {
    const [[row]] = await connection.query(
        `SELECT COUNT(*) AS total FROM ${quoteIdentifier(database)}.${quoteIdentifier(table)}`
    );
    return Number(row.total);
}

async function main() {
    const sourceDatabase = requireSafeEnvironment();
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD
    });
    let demoCreated = false;

    try {
        const [[source]] = await connection.execute(
            `SELECT DEFAULT_CHARACTER_SET_NAME AS charsetName, DEFAULT_COLLATION_NAME AS collationName
             FROM information_schema.SCHEMATA
             WHERE SCHEMA_NAME = ?`,
            [sourceDatabase]
        );
        if (!source) throw new Error('La base de desarrollo configurada no existe');

        const [[existingDemo]] = await connection.execute(
            'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
            [DEMO_DATABASE]
        );
        if (existingDemo) throw new Error(`${DEMO_DATABASE} ya existe; no se sobrescribió`);

        const [unsupported] = await connection.execute(
            `SELECT TABLE_NAME AS objectName, TABLE_TYPE AS objectType
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = ? AND TABLE_TYPE <> 'BASE TABLE'`,
            [sourceDatabase]
        );
        const [[triggerCount]] = await connection.execute(
            'SELECT COUNT(*) AS total FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?',
            [sourceDatabase]
        );
        if (unsupported.length > 0 || Number(triggerCount.total) > 0) {
            throw new Error('La base contiene vistas o triggers y requiere una estrategia de copia explícita');
        }

        const [tables] = await connection.execute(
            `SELECT TABLE_NAME AS tableName
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
             ORDER BY TABLE_NAME`,
            [sourceDatabase]
        );
        if (tables.length === 0) throw new Error('La base de desarrollo no contiene tablas');

        await connection.query(
            `CREATE DATABASE ${quoteIdentifier(DEMO_DATABASE)} CHARACTER SET ${source.charsetName} COLLATE ${source.collationName}`
        );
        demoCreated = true;
        await connection.query(`USE ${quoteIdentifier(DEMO_DATABASE)}`);
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');

        for (const { tableName } of tables) {
            const [[definition]] = await connection.query(
                `SHOW CREATE TABLE ${quoteIdentifier(sourceDatabase)}.${quoteIdentifier(tableName)}`
            );
            await connection.query(definition['Create Table']);
        }

        let copiedRows = 0;
        for (const { tableName } of tables) {
            await connection.query(
                `INSERT INTO ${quoteIdentifier(DEMO_DATABASE)}.${quoteIdentifier(tableName)}
                 SELECT * FROM ${quoteIdentifier(sourceDatabase)}.${quoteIdentifier(tableName)}`
            );
            const sourceRows = await countRows(connection, sourceDatabase, tableName);
            const demoRows = await countRows(connection, DEMO_DATABASE, tableName);
            if (sourceRows !== demoRows) throw new Error(`La copia de ${tableName} no coincide`);
            copiedRows += demoRows;
        }

        await connection.query('SET FOREIGN_KEY_CHECKS = 1');

        const users = tables.some(({ tableName }) => tableName === 'users')
            ? await countRows(connection, DEMO_DATABASE, 'users')
            : 0;
        const [[adminSummary]] = tables.some(({ tableName }) => tableName === 'admins')
            ? await connection.query(
                `SELECT COUNT(*) AS total,
                        SUM(role = 'SUPER_ADMIN' AND status = 'ACTIVE') AS activeSuperAdmins
                 FROM ${quoteIdentifier(DEMO_DATABASE)}.admins`
            )
            : [[{ total: 0, activeSuperAdmins: 0 }]];

        console.log(JSON.stringify({
            database: DEMO_DATABASE,
            tables: tables.length,
            copiedRows,
            users,
            admins: Number(adminSummary.total),
            activeSuperAdmins: Number(adminSummary.activeSuperAdmins || 0)
        }));
    } catch (error) {
        if (demoCreated) {
            await connection.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
            await connection.query(`DROP DATABASE ${quoteIdentifier(DEMO_DATABASE)}`).catch(() => {});
        }
        throw error;
    } finally {
        await connection.end();
    }
}

main().catch(error => {
    console.error(`[DEMO DB] ${error.message}`);
    process.exitCode = 1;
});
