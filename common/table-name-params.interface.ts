import { TableTier } from './api';

export interface TableNameParams {
    rawName: string;
    tier: TableTier;
    cleanName: string;
    masterRawName: string | null;
}
