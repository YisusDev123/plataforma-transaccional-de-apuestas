import config from './config.js';
import { crearApp } from './app.js';
import { closeDb, initDb } from './src/config/pool.js';
import { contenedor } from './src/container/setting-container.js';
import { jobsOrquestador } from './src/container/job-container.js';
import { prepareApplication } from './src/config/bootstrap.js';
import { createGracefulShutdown } from './src/config/shutdown.js';
import { configureHttpServer } from './src/config/http-server.js';
import { createFatalErrorHandler } from './src/config/process-errors.js';

const { settingsService } = contenedor;

async function main() {
    const app = await prepareApplication({
        initializeDatabase: initDb,
        loadSettings: () => settingsService.loadCache(),
        createApplication: crearApp
    });

    let server = null;
    const shutdown = createGracefulShutdown({
        getServer: () => server,
        stopJobs: () => jobsOrquestador.detener(),
        closeDatabase: closeDb,
        timeoutMs: config.app.http.shutdownTimeoutMs
    });
    const fatal = createFatalErrorHandler({ shutdown });
    process.once('uncaughtException', error => fatal('uncaughtException', error));
    process.once('unhandledRejection', error => fatal('unhandledRejection', error));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));

    const role = config.app.processRole;
    if (role === 'all' || role === 'worker') await jobsOrquestador.iniciar();

    if (role === 'all' || role === 'api') {
        server = app.listen(app.get('port'), () => {
            console.log(`[BOOT] API escuchando en el puerto ${app.get('port')} con rol ${role}.`);
        });
        configureHttpServer(server, config.app.http);
        server.on('error', error => fatal('httpServer', error));
    } else {
        console.log('[BOOT] Worker de jobs iniciado sin servidor HTTP.');
    }

}

main().catch(async error => {
    console.error(`[FATAL BOOT ERROR] ${error?.code || error?.name || 'BOOT_FAILURE'}`);
    await jobsOrquestador.detener().catch(() => {});
    await closeDb().catch(() => {});
    process.exitCode = 1;
});
