import { SqlRow } from '.';

export interface TableInsert {
    [tableName: string]: SqlRow[];
}
