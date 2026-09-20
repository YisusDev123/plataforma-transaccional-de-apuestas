function size(collection) {
    return Number(collection?.length) || 0;
}

export function createPoolMetrics() {
    let corePool = null;
    const state = {
        physicalConnectionsCreated: 0,
        totalAcquisitions: 0,
        totalEnqueued: 0,
        rejectedAcquisitions: 0,
        queuedWaitsCompleted: 0,
        queuedWaitMsTotal: 0,
        maxQueuedWaitMs: 0,
        peakActiveConnections: 0,
        peakQueuedRequests: 0
    };

    function liveState() {
        if (!corePool) return { physicalConnections: 0, activeConnections: 0, queuedRequests: 0 };
        const physicalConnections = size(corePool._allConnections);
        const freeConnections = size(corePool._freeConnections);
        return {
            physicalConnections,
            activeConnections: Math.max(0, physicalConnections - freeConnections),
            queuedRequests: size(corePool._connectionQueue)
        };
    }

    function samplePeaks() {
        const live = liveState();
        state.peakActiveConnections = Math.max(state.peakActiveConnections, live.activeConnections);
        state.peakQueuedRequests = Math.max(state.peakQueuedRequests, live.queuedRequests);
    }

    return {
        attach(pool) {
            corePool = pool;
            samplePeaks();
        },
        onConnection() {
            state.physicalConnectionsCreated += 1;
            samplePeaks();
        },
        onRequestSubmitted() {
            samplePeaks();
        },
        onAcquisitionResult({ error, wasQueued, waitMs }) {
            if (error) state.rejectedAcquisitions += 1;
            else state.totalAcquisitions += 1;
            if (wasQueued) {
                state.totalEnqueued += 1;
                if (!error) {
                    state.queuedWaitsCompleted += 1;
                    state.queuedWaitMsTotal += waitMs;
                    state.maxQueuedWaitMs = Math.max(state.maxQueuedWaitMs, waitMs);
                }
            }
            samplePeaks();
        },
        onAcquire() {
            state.totalAcquisitions += 1;
        },
        onRelease() {},
        onEnqueue() {
            state.totalEnqueued += 1;
        },
        snapshot() {
            const live = liveState();
            return {
                ...live,
                ...state,
                queuedWaitMsTotal: Number(state.queuedWaitMsTotal.toFixed(3)),
                averageQueuedWaitMs: state.queuedWaitsCompleted
                    ? Number((state.queuedWaitMsTotal / state.queuedWaitsCompleted).toFixed(3))
                    : 0,
                maxQueuedWaitMs: Number(state.maxQueuedWaitMs.toFixed(3))
            };
        }
    };
}
