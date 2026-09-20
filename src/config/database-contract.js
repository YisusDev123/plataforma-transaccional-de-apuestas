export const REQUIRED_TABLES = Object.freeze([
    'users', 'user_sessions', 'user_kyc', 'wallets', 'wallet_transactions',
    'deposits', 'withdrawals', 'draws', 'number_limits', 'payout_rules',
    'bets', 'bet_items', 'draw_results', 'draw_payout_summaries', 'settings',
    'audit_logs', 'admins', 'admin_sessions', 'email_verifications', 'password_resets',
    'deposit_destinations', 'deposit_destination_state'
]);

export const REQUIRED_COLUMNS = Object.freeze([
    'users.id', 'users.email', 'users.status', 'users.email_verified',
    'user_sessions.user_id', 'user_sessions.refresh_token_hash', 'user_sessions.expires_at', 'user_sessions.revoked_at',
    'wallets.user_id', 'wallets.available_balance', 'wallets.held_balance',
    'deposits.request_id', 'deposits.reference_number', 'deposits.rejection_reason',
    'deposits.deposit_destination_id', 'deposit_destinations.type', 'deposit_destinations.destination_value',
    'deposit_destinations.account_holder', 'deposit_destinations.version',
    'deposit_destination_state.type', 'deposit_destination_state.current_destination_id',
    'withdrawals.request_id',
    'bets.request_id', 'bets.ticket_code', 'bets.customer_name_snapshot', 'bet_items.payout_processed',
    'bet_items.payout_multiplier_snapshot', 'draws.status', 'draws.close_at',
    'number_limits.draw_id', 'number_limits.number_played', 'payout_rules.version', 'draw_results.draw_id',
    'draw_results.processed_status', 'settings.setting_key', 'settings.setting_value',
    'admin_sessions.refresh_token_hash', 'email_verifications.verification_code',
    'password_resets.reset_code'
]);

export const AUDIT_REQUIRED_COLUMNS = Object.freeze([...new Set([
    ...REQUIRED_COLUMNS,
    'users.password_hash', 'users.kyc_status',
    'wallets.id',
    'bets.id', 'bets.user_id', 'bets.total_amount', 'bets.status',
    'bet_items.id', 'bet_items.bet_id', 'bet_items.draw_id', 'bet_items.number_played',
    'bet_items.amount', 'bet_items.status',
    'draws.id', 'draws.lottery', 'draws.schedule_time', 'draws.modality', 'draws.draw_date', 'draws.open_at',
    'draw_results.id', 'draw_results.winning_number',
    'number_limits.id', 'number_limits.max_amount', 'number_limits.current_amount',
    'payout_rules.id', 'payout_rules.lottery', 'payout_rules.modality', 'payout_rules.multiplier', 'payout_rules.is_active',
    'deposits.id', 'deposits.user_id', 'deposits.amount', 'deposits.status',
    'withdrawals.id', 'withdrawals.user_id', 'withdrawals.amount',
    'withdrawals.withdrawal_account_snapshot', 'withdrawals.status',
    'deposit_destinations.id', 'deposit_destinations.created_by_admin_id', 'deposit_destinations.created_at',
    'deposit_destination_state.version', 'deposit_destination_state.updated_at'
])]);

export const REQUIRED_UNIQUE_INDEXES = Object.freeze([
    ['users', 'email'], ['wallets', 'user_id'], ['deposits', 'reference_number'],
    ['deposits', 'request_id'], ['withdrawals', 'request_id'], ['bets', 'request_id'],
    ['bets', 'ticket_code'], ['draw_results', 'draw_id'],
    ['number_limits', 'draw_id,number_played'], ['settings', 'setting_key'],
    ['user_sessions', 'refresh_token_hash'], ['admin_sessions', 'refresh_token_hash'],
    ['deposit_destinations', 'type,version']
]);

export const REQUIRED_QUERY_INDEXES = Object.freeze([
    ['bets', 'user_id,created_at,id'], ['deposits', 'user_id,created_at,id'],
    ['withdrawals', 'user_id,created_at,id'], ['deposits', 'deposit_destination_id'],
    ['wallet_transactions', 'reference_type,reference_id,type,status']
]);

export const REQUIRED_SETTINGS = Object.freeze([
    'system_status', 'financial_rules', 'draw_defaults', 'kyc_policies',
    'deposits_rules', 'withdraws_rules'
]);
