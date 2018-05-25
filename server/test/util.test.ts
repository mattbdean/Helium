import { expect } from 'chai';
import * as _ from 'lodash';
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
                    name: {
                        raw: '#foo',
                        clean: 'Foo'
                    },
                    masterName: null,
                    tier: 'lookup',
                    parts: [
                        new TableName(schema, {
                            name: { raw: '#foo__bar', clean: 'Bar' },
                            tier: 'lookup',
                            masterName: { raw: '#foo', clean: 'Foo' }
                        }),
                        new TableName(schema, {
                            name: { raw: '#foo__bar__baz', clean: 'BarBaz' },
                            tier: 'lookup',
                            masterName: { raw: '#foo', clean: 'Foo' },
                        })
                    ]
                },
                {
                    schema,
                    name: { raw: '_qux', clean: 'Qux' },
                    tier: 'imported',
                    masterName: null,
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
