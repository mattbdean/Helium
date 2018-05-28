import { TableTier, TransformedName } from './api';

export interface TableNameParams {
    name: TransformedName;
    tier: TableTier;
    masterName: TransformedName | null;
}
