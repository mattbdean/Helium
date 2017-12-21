import * as _ from 'lodash';

import { expect } from 'chai';

import { MasterTableName } from '../../common/api';
import { TableName } from '../../common/table-name.class';
import { unflattenTableNames } from '../../common/util';

describe('common/util', () => {
    describe('unflattenTableNames', () => {
        it('should properly assign part tables to their correct masters', () => {
            const schema = 'schema';
            const tables: TableName[] = _.map(
                ['#foo', '#foo__bar', '#foo__bar__baz', '_qux'],
                (n) => new TableName(schema, n));

            const expected: MasterTableName[] = [
                {
                    schema,
                    rawName: '#foo',
                    tier: 'lookup',
                    cleanName: 'foo',
                    parts: [
                        new TableName(schema, {
                            rawName: '#foo__bar',
                            tier: 'lookup',
                            cleanName: 'bar',
                            masterRawName: '#foo'
                        }),
                        new TableName(schema, {
                            rawName: '#foo__bar__baz',
                            tier: 'lookup',
                            cleanName: 'bar__baz',
                            masterRawName: '#foo'
                        })
                    ]
                },
                {
                    schema,
                    rawName: '_qux',
                    tier: 'imported',
                    cleanName: 'qux',
                    parts: []
                }
            ];
            expect(unflattenTableNames(tables)).to.deep.equal(expected);
        });

        it('should throw an error when given a part table with no master', () => {
            const tables: TableName[] = [new TableName('baz', 'foo__bar')];

            expect(() => unflattenTableNames(tables)).to.throw(Error);
        });
    });
});
