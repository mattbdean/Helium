import { expect } from 'chai';
import { TableTier } from '../../common/api';
import { TableName } from '../../common/table-name.class';

describe('TableName', () => {
    const tables = ['foo_bar', '#foo_bar', '_foo_bar', '__foo_bar', '~foo_bar'];
    const expectedTypes: TableTier[] =
        ['manual', 'lookup', 'imported', 'computed', 'hidden'];

    it('should correctly identify the tier and clean name of a table', () => {
        for (let i = 0; i < tables.length; i++) {
            const name = new TableName('schema', tables[i]);
            expect(name.tier).to.equal(expectedTypes[i]);
            expect(name.name).to.deep.equal({
                raw: tables[i],
                clean: 'FooBar'
            });
            expect(name.masterName).to.be.null;
        }
    });

    it('should correctly handle part tables', () => {
        for (let i = 0; i < tables.length; i++) {
            const name = new TableName('schema', tables[i] + '__part');
            expect(name).to.deep.equal({
                name: {
                    raw: tables[i] + '__part',
                    clean: 'Part'
                },
                masterName: {
                    raw: tables[i],
                    clean: 'FooBar'
                },
                tier: expectedTypes[i],
                schema: 'schema'
            });
        }
    });

    it('should acknowledge a maximum of one part table', () => {
        // When using DataJoint alone, there'll never be a time two underscores
        // appear more than twice in a table name. The first occurrence would be
        // to mark the table as imported, the second would be to denote a part
        // table. Nested part tables aren't allowed. When DataJoint goes to
        // map a Python class name, say FooBar, it gets turned into foo_bar.
        // This is unlikely to ever happen in real life.
        const name = new TableName('schema', '__foo__part__other');
        expect(name).to.deep.equal(new TableName('schema', {
            name: {
                raw: '__foo__part__other',
                clean: 'PartOther'
            },
            masterName: {
                raw: '__foo',
                clean: 'Foo'
            },
            tier: 'computed',
        }));
    });
});
