import cron from 'node-cron';
import { withMysqlLock } from '../../shared/database/distributed-lock.js';

export function iniciarCronJobs(jobsService, payoutSql, ejecutarMotorDePagos, { pool, jobState } = {}) {
    if (process.env.NODE_ENV === 'test') return { tasks: [], bootPromise: Promise.resolve() };

    const scheduledTasks = [];
    const execute = async (name, maximumSilenceMs, operation) => {
        try {
            return await jobState.run(name, maximumSilenceMs, () => withMysqlLock(
                pool, `lottery:job:${name}`, operation
            ));
        } catch {
            console.error(`[JOBS ERROR] Falló la tarea ${name}.`);
            return null;
        }
    };

    const generateDraws = () => execute('generate-draws', 26 * 60 * 60 * 1000, () => jobsService.generarSorteosDelDia());
    const updateStates = () => execute('update-draw-states', 3 * 60 * 1000, () => jobsService.procesarCambiosDeEstado());
    const processPayouts = () => execute('payout-watchdog', 8 * 60 * 1000, async () => {
        const pendingResults = await payoutSql.getPendingResults();
        if (pendingResults.length > 0) await ejecutarMotorDePagos(payoutSql);
    });

    const bootPromise = (async () => {
        await generateDraws();
        await updateStates();
        await processPayouts();
    })();

    scheduledTasks.push(cron.schedule('0 0 * * *', generateDraws, { timezone: 'America/Costa_Rica' }));
    scheduledTasks.push(cron.schedule('* * * * *', updateStates, { timezone: 'America/Costa_Rica' }));
    scheduledTasks.push(cron.schedule('*/5 * * * *', processPayouts, { timezone: 'America/Costa_Rica' }));

    return { tasks: scheduledTasks, bootPromise };
}
