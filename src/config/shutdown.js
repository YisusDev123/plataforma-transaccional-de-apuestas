export function createGracefulShutdown({
    getServer,
    stopJobs,
    closeDatabase,
    exit = code => process.exit(code),
    timeoutMs = 10000
}) {
    let stopping = false;

    return async (signal, { exitCode = 0 } = {}) => {
        if (stopping) return false;
        stopping = true;

        const forceTimer = setTimeout(() => exit(1), timeoutMs);
        forceTimer.unref?.();
        try {
            const server = getServer();
            if (server) {
                await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
                server.closeIdleConnections?.();
            }
            await stopJobs();
            await closeDatabase();
            clearTimeout(forceTimer);
            exit(exitCode);
            return true;
        } catch {
            clearTimeout(forceTimer);
            exit(1);
            return false;
        }
    };
}
