import * as _ from 'lodash';

import { expect } from 'chai';

import { MasterTableName, TableName, TableTier } from '../../common/api';
import { createTableName } from '../src/common/util';
import { unflattenTableNames } from '../../common/util';

describe('common/util', () => {
    describe('createTableName', () => {
        const tables = ['foo', '#foo', '_foo', '__foo', '~foo'];
        const expectedTypes: TableTier[] =
            ['manual', 'lookup', 'imported', 'computed', 'hidden'];

        it('should correctly identify the tier and clean name of a table', () => {
            const names = _.map(tables, (t) => createTableName(t));

            expect(_.map(names, (n) => n.tier)).to.deep.equal(expectedTypes);

            for (const name of names) {
                expect(name.cleanName).to.equal('foo');
                expect(name.masterRawName).to.be.null;
            }
        });

        it('should correctly handle part tables', () => {
            const names = _.map(tables, (t) => createTableName(t + '__part'));
            expect(_.map(names, (n) => n.tier)).to.deep.equal(expectedTypes);

            for (const name of names) {
                expect(name.cleanName).to.equal('part');
                expect(name.masterRawName).to.match(/foo$/);
            }
        });

        it('should acknowledge a maximum of one part table', () => {
            const name = createTableName('__foo__part__other');
            expect(name).to.deep.equal({
                rawName: '__foo__part__other',
                tier: 'computed',
                cleanName: 'part__other',
                masterRawName: '__foo'
            });
        });
    });

    describe('unflattenTableNames', () => {
        it('should properly assign part tables to their correct masters', () => {
            const tables: TableName[] = _.map(
                ['#foo', '#foo__bar', '#foo__bar__baz', '_qux'],
                (n) => createTableName(n));

            const expected: MasterTableName[] = [
                {
                    rawName: '#foo',
                    tier: 'lookup',
                    cleanName: 'foo',
                    parts: [
                        {
                            rawName: '#foo__bar',
                            tier: 'lookup',
                            cleanName: 'bar',
                            masterRawName: '#foo'
                        },
                        {
                            rawName: '#foo__bar__baz',
                            tier: 'lookup',
                            cleanName: 'bar__baz',
                            masterRawName: '#foo'
                        }
                    ]
                },
                {
                    rawName: '_qux',
                    tier: 'imported',
                    cleanName: 'qux',
                    parts: []
                }
            ];
            expect(unflattenTableNames(tables)).to.deep.equal(expected);
        });

        it('should throw an error when given a part table with a master', () => {
            const tables: TableName[] = [createTableName('foo__bar')];

            expect(() => unflattenTableNames(tables)).to.throw(Error);
        });
    });
});
