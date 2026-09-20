export async function applyDrawDefaultsMigration(connection, closeMinutes = 10) {
    if (!Number.isInteger(closeMinutes) || closeMinutes < 10 || closeMinutes > 20) {
        throw new Error('AUTO_CLOSE_MINUTES_BEFORE debe ser un entero entre 10 y 20.');
    }

    await connection.beginTransaction();
    try {
        const [settings] = await connection.query(`
            SELECT setting_value
            FROM settings
            WHERE setting_key = 'draw_defaults'
            FOR UPDATE
        `);
        if (settings.length !== 1) throw new Error('No existe la configuración draw_defaults.');

        const currentValue = typeof settings[0].setting_value === 'string'
            ? JSON.parse(settings[0].setting_value)
            : settings[0].setting_value;
        const previousCloseMinutes = Number(currentValue.auto_close_minutes_before);
        const settingChanged = previousCloseMinutes !== closeMinutes;

        const [activeDraws] = await connection.query(`
            SELECT id, status
            FROM draws
            WHERE status IN ('PENDING', 'OPEN')
            ORDER BY id
            FOR UPDATE
        `);
        if (settingChanged) {
            if (activeDraws.some(draw => draw.status === 'OPEN')) {
                const error = new Error('No se puede migrar el cierre mientras exista un sorteo OPEN.');
                error.publicCode = 'OPEN_DRAWS_PREVENT_CLOSE_RULE_CHANGE';
                throw error;
            }
        }

        const [updatedDraws] = await connection.query(`
            UPDATE draws
            SET close_at = DATE_SUB(
                DATE_ADD(TIMESTAMP(draw_date, schedule_time), INTERVAL 6 HOUR),
                INTERVAL ? MINUTE
            )
            WHERE status = 'PENDING'
        `, [closeMinutes]);
        if (settingChanged) {
            const nextValue = { ...currentValue, auto_close_minutes_before: closeMinutes };
            await connection.query(
                `UPDATE settings SET setting_value = ? WHERE setting_key = 'draw_defaults'`,
                [JSON.stringify(nextValue)]
            );
        }
        await connection.commit();
        return {
            changed: settingChanged,
            previousCloseMinutes,
            closeMinutes,
            pendingDrawsUpdated: updatedDraws.affectedRows
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    }
}
