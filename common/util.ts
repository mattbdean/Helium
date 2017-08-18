import * as _ from 'lodash';

import { MasterTableName, TableName, TableTier } from './api';
import { TABLE_TIER_PREFIX_MAPPING } from './constants';

////////////////////////////////////////////////////////////////////////////////
// Tests are located with server-side tests
////////////////////////////////////////////////////////////////////////////////

const masterPartSeparator = '__';

/**
 * Creates a TableName from a given SQL table name
 * @param {string} sqlName The name of the table as it is mentioned in SQL
 */
export const createTableName = (sqlName: string): TableName => {
    // Assume the table is a manual table and therefore has no prefix
    let tier: TableTier = 'manual';
    let startTrim = 0;

    let identifiers = [sqlName];
    if (sqlName.includes(masterPartSeparator)) {
        // Remember if the name starts with the master-part separator (as is the
        // case with computed tables)
        const startsWithSeparator = sqlName.startsWith(masterPartSeparator);

        // Don't include the separator at the beginning
        const tempName = startsWithSeparator ? sqlName.substring(masterPartSeparator.length) : sqlName;

        // Identify the master and part names
        identifiers = tempName.split(masterPartSeparator);

        // Add the prefix back to the master name, if applicable
        if (startsWithSeparator)
            identifiers[0] = masterPartSeparator + identifiers[0];

        // Make sure we only have one master name and one part name in our array.
        // If given a table name of 'one__two__three', we want to report that
        // the master name is 'one' and the part name is 'two__three'.
        if (identifiers.length > 1) {
            const partName = identifiers.slice(1).join(masterPartSeparator);
            identifiers = [identifiers[0], partName];
        }
    }

    const masterName = identifiers[0];

    for (const prefix of Object.keys(TABLE_TIER_PREFIX_MAPPING)) {
        if (masterName.startsWith(prefix)) {
            startTrim = prefix.length;
            tier = TABLE_TIER_PREFIX_MAPPING[prefix];
            break;
        }
    }

    const isPartTable = identifiers.length > 1;

    const cleanName = isPartTable ?
        // The second element in the identifiers array is the name of the part table
        identifiers[1] :
        // This is a master table, remove the prefix from the masterName
        (startTrim === 0 ? masterName : masterName.substring(startTrim));

    const masterRawName = isPartTable ? identifiers[0] : null;

    return {
        rawName: sqlName,
        tier,
        cleanName,
        masterRawName
    };
};

export const unflattenTableNames = (names: TableName[]): MasterTableName[] => {
    const partitioned = _.partition(names, (n) => n.masterRawName === null);
    const masters = _.map(partitioned[0], (n): MasterTableName => ({
        rawName: n.rawName,
        tier: n.tier,
        cleanName: n.cleanName,
        parts: []
    }));

    const parts: TableName[] = partitioned[1];

    for (const part of parts) {
        const masterIndex = _.findIndex(masters, (m) => m.rawName === part.masterRawName);
        if (masterIndex < 0)
            throw new Error(`Could not find master table with name ${part.masterRawName}`);

        masters[masterIndex].parts.push(part);
    }
    return masters;
};
