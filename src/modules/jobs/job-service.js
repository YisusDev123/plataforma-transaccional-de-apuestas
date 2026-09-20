export function iniciarJobsService(jobsSql, pool, settingsService) {
    return {
        async generarSorteosDelDia() {
            const nowCR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica" }));
            const yyyy = nowCR.getFullYear();
            const mm = String(nowCR.getMonth() + 1).padStart(2, '0');
            const dd = String(nowCR.getDate()).padStart(2, '0');
            const fechaCR = `${yyyy}-${mm}-${dd}`;

            const diaSemana = nowCR.getDay();
            const esFinDeSemana = (diaSemana === 0 || diaSemana === 6);

            let catalogo = [
                { lottery: 'NICA', schedule_time: '11:00:00', modality: 'NORMAL' },
                { lottery: 'NICA', schedule_time: '15:00:00', modality: 'NORMAL' },
                { lottery: 'NICA', schedule_time: '21:00:00', modality: 'NORMAL' },
                { lottery: 'TICA', schedule_time: '13:00:00', modality: 'NORMAL' },
                { lottery: 'TICA', schedule_time: '13:00:00', modality: 'MEGA_REVENTADO' },
                { lottery: 'TICA', schedule_time: '16:30:00', modality: 'NORMAL' },
                { lottery: 'TICA', schedule_time: '16:30:00', modality: 'MEGA_REVENTADO' },
                { lottery: 'TICA', schedule_time: '19:30:00', modality: 'NORMAL' },
                { lottery: 'TICA', schedule_time: '19:30:00', modality: 'MEGA_REVENTADO' }
            ];

            if (esFinDeSemana) {
                catalogo.push({ lottery: 'NICA', schedule_time: '18:00:00', modality: 'NORMAL' });
            }

            const drawDefaults = settingsService.get('draw_defaults') || {};
            const limiteConfigurado = Number(drawDefaults.default_risk_limit);
            const cierreConfigurado = Number(drawDefaults.auto_close_minutes_before);
            const limiteGlobal = Number.isFinite(limiteConfigurado) ? limiteConfigurado : 3000;
            if (!Number.isInteger(cierreConfigurado) || cierreConfigurado < 10 || cierreConfigurado > 20) {
                throw new Error('auto_close_minutes_before debe ser un entero entre 10 y 20.');
            }
            const minutosAntesDelCierre = cierreConfigurado;

            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const openDateObject = new Date(`${fechaCR}T00:00:00-06:00`);
                const openAtUTC = openDateObject.toISOString().slice(0, 19).replace('T', ' ');

                for (const sorteo of catalogo) {
                    const drawDateObject = new Date(`${fechaCR}T${sorteo.schedule_time}-06:00`);
                    const closeDateObject = new Date(drawDateObject.getTime() - (minutosAntesDelCierre * 60 * 1000));
                    const closeAtUTC = closeDateObject.toISOString().slice(0, 19).replace('T', ' ');

                    await jobsSql.guardarOSobreescribirSorteo(connection, {
                        ...sorteo,
                        draw_date: fechaCR,
                        open_at: openAtUTC,
                        close_at: closeAtUTC
                    }, limiteGlobal);
                }

                await connection.commit();
                console.log(`[JOBS] 🚀 Sorteos procesados (creados/sobrescritos) para la fecha ${fechaCR}`);
            } catch (error) {
                await connection.rollback();
                console.error("[JOBS ERROR] Fallo al generar sorteos.");
                throw error;
            } finally {
                connection.release();
            }
        },

        async procesarCambiosDeEstado() {
            try {
                const nowCR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica" }));
                const yyyy = nowCR.getFullYear();
                const mm = String(nowCR.getMonth() + 1).padStart(2, '0');
                const dd = String(nowCR.getDate()).padStart(2, '0');
                const fechaCR = `${yyyy}-${mm}-${dd}`;

                const deHoy = await jobsSql.escanearYActualizarEstados(fechaCR);
                console.log(`[JOBS] 🔄 Sorteos de hoy -> Abiertos: ${deHoy.abiertos}, Cerrados: ${deHoy.cerrados}`);
                if (deHoy.incompletos > 0) {
                    console.error(`[JOBS INTEGRITY] ${deHoy.incompletos} sorteo(s) permanecen PENDING porque no tienen exactamente 100 límites.`);
                }
            } catch (error) {
                console.error("[JOBS ERROR] Fallo al actualizar estados.");
                throw error;
            }
        }
    };
}
