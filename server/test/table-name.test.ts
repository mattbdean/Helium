import { expect } from 'chai';
import * as _ from 'lodash';

import { TableTier } from '../../common/api';
import { TableName } from '../../common/table-name.class';

describe('TableName', () => {
    const tables = ['foo', '#foo', '_foo', '__foo', '~foo'];
    const expectedTypes: TableTier[] =
        ['manual', 'lookup', 'imported', 'computed', 'hidden'];

    it('should correctly identify the tier and clean name of a table', () => {
        const names = _.map(tables, (t) => new TableName(t));

        expect(_.map(names, (n) => n.tier)).to.deep.equal(expectedTypes);

        for (const name of names) {
            expect(name.cleanName).to.equal('foo');
            expect(name.masterRawName).to.be.null;
        }
    });

    it('should correctly handle part tables', () => {
        const names = _.map(tables, (t) => new TableName(t + '__part'));
        expect(_.map(names, (n) => n.tier)).to.deep.equal(expectedTypes);

        for (const name of names) {
            expect(name.cleanName).to.equal('part');
            expect(name.masterRawName).to.match(/foo$/);
        }
    });

    it('should acknowledge a maximum of one part table', () => {
        const name = new TableName('__foo__part__other');
        expect(name).to.deep.equal(new TableName({
            rawName: '__foo__part__other',
            tier: 'computed',
            cleanName: 'part__other',
            masterRawName: '__foo'
        }));
    });
});
