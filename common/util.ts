
import { TableName, TableTier } from './api';
import { TABLE_TIER_PREFIX_MAPPING } from './constants';

/**
 * Creates a TableName from a given SQL table name
 * @param {string} sqlName The name of the table as it is mentioned in SQL
 */
export const createTableName = (sqlName: string): TableName => {
    // Assume the table is a manual table and therefore has no prefix
    let tier: TableTier = 'manual';
    let startTrim = 0;

    for (const prefix of Object.keys(TABLE_TIER_PREFIX_MAPPING)) {
        if (sqlName.startsWith(prefix)) {
            startTrim = prefix.length;
            tier = TABLE_TIER_PREFIX_MAPPING[prefix];
            break;
        }
    }

    return {
        rawName: sqlName,
        tier,
        cleanName: startTrim === 0 ? sqlName : sqlName.substring(startTrim)
    };
};
