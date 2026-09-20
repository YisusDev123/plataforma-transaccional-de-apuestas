export function createFatalErrorHandler({ shutdown, log = console.error }) {
    let handled = false;
    return async (source, error) => {
        if (handled) return false;
        handled = true;
        const safeCode = typeof error?.code === 'string'
            ? error.code
            : (typeof error?.name === 'string' ? error.name : 'RUNTIME_FAILURE');
        log(`[FATAL RUNTIME ERROR] ${source}:${safeCode}`);
        return shutdown(source, { exitCode: 1 });
    };
}
