import { TableTier } from './api';

export interface TransformedName {
    raw: string;
    clean: string;
}

export interface TableNameParams {
    name: TransformedName;
    tier: TableTier;
    masterName: TransformedName | null;
}
