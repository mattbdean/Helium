import * as _ from 'lodash';

import { MasterTableName } from './api';
import { TableName } from './table-name.class';

////////////////////////////////////////////////////////////////////////////////
// Tests are located with server-side tests
////////////////////////////////////////////////////////////////////////////////

export const unflattenTableNames = (names: TableName[]): MasterTableName[] => {
    const partitioned = _.partition(names, (n) => !n.isPartTable());
    const masters = _.map(partitioned[0], (n): MasterTableName => ({
        schema: n.schema,
        name: n.name,
        tier: n.tier,
        masterName: n.masterName,
        parts: []
    }));

    const parts: TableName[] = partitioned[1];

    for (const part of parts) {
        const masterIndex = _.findIndex(masters, (m) =>
            !!part.masterName && m.name.raw === part.masterName.raw);

        if (masterIndex < 0)
            throw new Error(`Could not find master table with name ${part.masterName!!.raw}`);

        masters[masterIndex].parts.push(part);
    }
    return masters;
};
