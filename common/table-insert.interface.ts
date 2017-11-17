
import { SqlRow } from './api';

export interface TableInsert {
    [tableName: string]: SqlRow[];
}
