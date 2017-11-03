import * as _ from 'lodash';

import { MasterTableName } from './api';
import { TableName } from './table-name';

////////////////////////////////////////////////////////////////////////////////
// Tests are located with server-side tests
////////////////////////////////////////////////////////////////////////////////

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
