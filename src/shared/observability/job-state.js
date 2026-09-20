export function createJobStateRegistry({ now = () => Date.now() } = {}) {
    const jobs = new Map();

    function ensure(name, maximumSilenceMs) {
        if (!jobs.has(name)) {
            jobs.set(name, {
                name,
                maximumSilenceMs,
                running: false,
                runs: 0,
                failures: 0,
                lastStartedAt: null,
                lastSuccessAt: null,
                lastFailureAt: null
            });
        }
        return jobs.get(name);
    }

    async function run(name, maximumSilenceMs, operation) {
        const state = ensure(name, maximumSilenceMs);
        state.running = true;
        state.lastStartedAt = new Date(now()).toISOString();
        state.runs += 1;
        try {
            const result = await operation();
            state.lastSuccessAt = new Date(now()).toISOString();
            return result;
        } catch (error) {
            state.failures += 1;
            state.lastFailureAt = new Date(now()).toISOString();
            throw error;
        } finally {
            state.running = false;
        }
    }

    function snapshot() {
        const timestamp = now();
        return [...jobs.values()].map(state => {
            const lastSuccessMs = state.lastSuccessAt ? Date.parse(state.lastSuccessAt) : null;
            return {
                ...state,
                healthy: state.running || (lastSuccessMs !== null && timestamp - lastSuccessMs <= state.maximumSilenceMs)
            };
        });
    }

    async function waitForIdle(timeoutMs = 5000) {
        const deadline = now() + timeoutMs;
        while ([...jobs.values()].some(state => state.running)) {
            if (now() >= deadline) return false;
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        return true;
    }

    return { run, snapshot, waitForIdle };
}
