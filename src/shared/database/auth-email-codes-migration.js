const CODE_COLUMNS = Object.freeze([
    { table: 'email_verifications', column: 'verification_code' },
    { table: 'password_resets', column: 'reset_code' },
])

async function columnLength(connection, table, column) {
    const [[row]] = await connection.query(`
        SELECT character_maximum_length AS maximumLength
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
    `, [table, column])
    return row ? Number(row.maximumLength) : null
}

export async function applyAuthEmailCodesMigration(connection) {
    const actions = []
    for (const definition of CODE_COLUMNS) {
        const length = await columnLength(connection, definition.table, definition.column)
        if (length === null) throw new Error(`Falta ${definition.table}.${definition.column}`)
        if (length < 64) {
            await connection.query(
                `ALTER TABLE \`${definition.table}\` MODIFY COLUMN \`${definition.column}\` VARCHAR(64) NOT NULL`
            )
            actions.push(`${definition.table}.${definition.column}:varchar(64)`)
        }
        const [expired] = await connection.query(
            `UPDATE \`${definition.table}\` SET status = 'EXPIRED' WHERE status = 'PENDING' AND CHAR_LENGTH(\`${definition.column}\`) <> 64`
        )
        if (expired.affectedRows > 0) actions.push(`${definition.table}:expired_legacy=${expired.affectedRows}`)
    }
    return { changed: actions.length > 0, actions }
}

export const authEmailCodeColumns = CODE_COLUMNS
