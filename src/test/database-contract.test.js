import { describe, expect, test } from '@jest/globals';
import {
    AUDIT_REQUIRED_COLUMNS,
    REQUIRED_COLUMNS,
    REQUIRED_QUERY_INDEXES,
    REQUIRED_TABLES,
    REQUIRED_UNIQUE_INDEXES
} from '../config/database-contract.js';

describe('contrato estructural compartido de MySQL', () => {
    test('mantiene las tablas de destinos dentro del preflight y la auditoría', () => {
        expect(REQUIRED_TABLES).toHaveLength(22);
        expect(REQUIRED_TABLES).toEqual(expect.arrayContaining([
            'deposit_destinations', 'deposit_destination_state'
        ]));
        expect(AUDIT_REQUIRED_COLUMNS).toEqual(expect.arrayContaining(REQUIRED_COLUMNS));
    });

    test('audita columnas e índices críticos del destino sin exigir la columna manual heredada', () => {
        expect(AUDIT_REQUIRED_COLUMNS).toEqual(expect.arrayContaining([
            'deposits.deposit_destination_id',
            'deposit_destinations.id',
            'deposit_destinations.type',
            'deposit_destinations.destination_value',
            'deposit_destinations.account_holder',
            'deposit_destinations.version',
            'deposit_destination_state.type',
            'deposit_destination_state.current_destination_id',
            'deposit_destination_state.version'
        ]));
        expect(AUDIT_REQUIRED_COLUMNS).not.toContain('draws.created_by_admin_id');
        expect(REQUIRED_UNIQUE_INDEXES).toContainEqual(['deposit_destinations', 'type,version']);
        expect(REQUIRED_QUERY_INDEXES).toContainEqual(['deposits', 'deposit_destination_id']);
    });
});
