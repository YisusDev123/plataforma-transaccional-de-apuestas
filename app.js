import express from "express"
import config from "./config.js"
import { createCorsOptions } from "./src/config/cors.js"


import helmet from "helmet"
import cors from "cors"
import morgan from "morgan"
import hpp from 'hpp';
import compression from 'compression';


import { globalLimiter } from "./src/shared/middleware/rate-limit.js"
import { globalErrorHandler } from "./src/shared/error/globalErrors.js"
import { notFoundHandler } from "./src/shared/middleware/not-found.js"
import routesAuth from "./src/modules/auth/auth-routes.js"
import routesWallet from "./src/modules/wallet/wallet-routes.js"
import routesDeposits from "./src/modules/deposits/deposits-routes.js.js"
import routesAdmin from "./src/modules/admin/admin-routes.js"
import routesWithdrawals from "./src/modules/withdrawls/withdrawls-route.js"
import routesBet from "./src/modules/bets/bet-routes.js"
import adminBetRoutes from './src/modules/bets/admin-bet-routes.js';
import routesDraw from "./src/modules/draw/draw-routes.js"
import numberLimit from "./src/modules/limits/limit-routes.js"
import rules from "./src/modules/settings/setting-routes.js"
import kycData from "./src/modules/kyc/kyc-routes.js"
import payoutRules from "./src/modules/payout-rules/payout-rule-routes.js"
import { systemAvailability } from "./src/container/setting-container.js"
import { correlationId } from './src/shared/middleware/correlation-id.js';
import { createMetricsRegistry } from './src/shared/observability/metrics.js';
import { createObservabilityRouter } from './src/shared/observability/routes.js';
import { pool, poolMetrics } from './src/config/pool.js';
import { settingsService } from './src/container/setting-container.js';
import { jobsOrquestador } from './src/container/job-container.js';
import { requireHttps } from './src/shared/middleware/require-https.js';


export function crearApp(runtimeConfig = config, dependencies = {}) {
    const app = express();
    const { maintenanceGuard } = systemAvailability;
    const metricsRegistry = dependencies.metricsRegistry || createMetricsRegistry();
    const observabilityDependencies = {
        pool: dependencies.pool || pool,
        poolMetrics: dependencies.poolMetrics || poolMetrics,
        settingsService: dependencies.settingsService || settingsService,
        jobsOrquestador: dependencies.jobsOrquestador || jobsOrquestador,
        metricsRegistry,
        runtimeConfig
    };

    app.use(correlationId);
    app.use(metricsRegistry.middleware);
    if (runtimeConfig.app.environment !== 'test') app.use(morgan("dev"));
    app.use(helmet());
    app.use(hpp());
    app.use(compression());
    app.set('trust proxy', runtimeConfig.app.trustProxy);
    app.use(requireHttps(runtimeConfig));
    app.use(cors(createCorsOptions(runtimeConfig.security.corsAllowedOrigins)));




    app.set("port", runtimeConfig.app.port)
    app.use(createObservabilityRouter(observabilityDependencies));
    app.use(globalLimiter);
    app.use(express.json({ limit: '10kb' }))
    app.use(express.urlencoded({ extended: true }));

    app.use("/auth", maintenanceGuard, routesAuth)
    app.use("/wallet", maintenanceGuard, routesWallet)
    app.use("/deposits", maintenanceGuard, routesDeposits)
    app.use("/admin/payout-rules", payoutRules)
    app.use('/admin/bets', adminBetRoutes)
    app.use("/admin", routesAdmin)
    app.use("/withdrawals", maintenanceGuard, routesWithdrawals)
    app.use("/bet", maintenanceGuard, routesBet)
    app.use("/draw", routesDraw)
    app.use("/numberLimit", numberLimit)
    app.use("/rules", rules)
    app.use("/kyc", maintenanceGuard, kycData)



    app.use(notFoundHandler)
    app.use(globalErrorHandler)
    return app
}
