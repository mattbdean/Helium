import { RequestContext } from '../api.test.helper';
import { setupRequestContext } from './setup';

import { expect } from 'chai';
import * as _ from 'lodash';
import { TableNameParams } from '../../src/common/table-name-params.interface';

const ALL_TABLES = [
    'customer',
    'organization',
    'product',
    'order',
    'shipment',
    'datatypeshowcase',
    'blob_test',
    'master',
    'master__part',
    'master__part2',
    'column_name_test',
    'defaults_test',
    '#test_lookup',
    '_test_imported',
    '__test_computed'
];

export default function() {
    let request: RequestContext;
    before(async () => {
        request = await setupRequestContext();
    });

    describe.only('GET /api/v1/tables', () => {
        it('should return an array of TableNames', () =>
            request.basic('/tables', 200, (data: TableNameParams[]) => {
                expect(Array.isArray(data)).to.be.true;
                expect(_.map(data, 'rawName')).to.deep.equal(_.sortBy(ALL_TABLES));

                for (const tableName of data) {
                    // Only work with non-part tables
                    if (tableName.masterRawName === null) {
                        if (tableName.tier === 'manual') {
                            // Manual tables have no prefix
                            expect(tableName.rawName).to.equal(tableName.cleanName);
                        } else {
                            // Non-manual tables have prefixes
                            expect(tableName.rawName).to.not.equal(tableName.cleanName);
                            // Make sure the raw name ends with the clean name
                            expect(tableName.rawName).to.match(new RegExp(tableName.cleanName + '$'));
                        }
                    }
                }
            })
        );
    });
}
