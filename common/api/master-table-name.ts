import { BaseTableName } from '.';
import { TableName } from '../table-name';

export interface MasterTableName extends BaseTableName {
    /**
     * Any part tables that belong to this master table.
     */
    parts: TableName[];
}
