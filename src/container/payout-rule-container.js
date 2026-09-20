import { pool } from '../config/pool.js';
import { iniciarBaseDeDatos } from '../shared/database/admin-sql.js';
import { iniciarPayoutRuleSql } from '../shared/database/payout-rule-sql.js';
import { iniciarAuthMiddleware } from '../shared/middleware/admin-jwt.js';
import { iniciarPayoutRuleService } from '../modules/payout-rules/payout-rule-services.js';
import { iniciarPayoutRuleController } from '../modules/payout-rules/payout-rule-controller.js';
import { settingsService } from './setting-container.js';

const payoutRuleSql = iniciarPayoutRuleSql(pool);
const payoutRuleService = iniciarPayoutRuleService(payoutRuleSql, settingsService);
const payoutRuleController = iniciarPayoutRuleController(payoutRuleService);
const verifyAdmin = iniciarAuthMiddleware(iniciarBaseDeDatos(pool));

export const payoutRuleContainer = { payoutRuleSql, payoutRuleService, payoutRuleController, verifyAdmin };
