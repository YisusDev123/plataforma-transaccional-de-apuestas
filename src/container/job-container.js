import { pool } from '../config/pool.js';
import { iniciarBaseDeDatosJobs } from '../shared/database/jobs-sql.js';
import { iniciarJobsService } from '../modules/jobs/job-service.js';
import { iniciarCronJobs } from '../modules/jobs/job-crons.js';
import { settingsService } from './setting-container.js';
import { eventBus } from '../shared/utils/events.js';
import { iniciarBaseDeDatosPayout } from '../shared/database/payout-sql.js';
import { ejecutarMotorDePagos, iniciarPayoutSubscribers } from '../modules/jobs/payout-worker.js';
import { createJobStateRegistry } from '../shared/observability/job-state.js';

const jobsSql = iniciarBaseDeDatosJobs(pool);
const jobsService = iniciarJobsService(jobsSql, pool, settingsService);
const payoutSql = iniciarBaseDeDatosPayout(pool);
const jobState = createJobStateRegistry();

let iniciado = false;
let scheduledTasks = [];
let unsubscribePayout = null;
const activePayouts = new Set();

function trackedPayout(payoutRepository) {
    const execution = ejecutarMotorDePagos(payoutRepository);
    activePayouts.add(execution);
    return execution.finally(() => activePayouts.delete(execution));
}

export const jobsOrquestador = {
    async iniciar() {
        if (iniciado || process.env.NODE_ENV === 'test') return false;
        unsubscribePayout = iniciarPayoutSubscribers(payoutSql, eventBus, trackedPayout);
        const { tasks, bootPromise } = iniciarCronJobs(jobsService, payoutSql, trackedPayout, { pool, jobState });
        scheduledTasks = tasks;
        iniciado = true;
        await bootPromise;
        return true;
    },
    async detener() {
        for (const task of scheduledTasks) task.stop();
        scheduledTasks = [];
        unsubscribePayout?.();
        unsubscribePayout = null;
        await jobState.waitForIdle();
        await Promise.allSettled([...activePayouts]);
        iniciado = false;
    },
    estaIniciado() {
        return iniciado;
    },
    obtenerEstado() {
        return jobState.snapshot();
    },
    async obtenerAlertas() {
        const databaseAlerts = await jobsSql.obtenerAlertasOperativas();
        return {
            ...databaseAlerts,
            stoppedJobs: jobState.snapshot().filter(job => !job.healthy).map(job => job.name)
        };
    }
};
