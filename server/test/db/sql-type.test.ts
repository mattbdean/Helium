import { expect } from 'chai';
import { SqlType } from '../../src/db/sql-type';

describe('SqlType', () => {
    describe('(constructor)', () => {
        it('should determine the base type', () => {
            expect(new SqlType('FOO')).to.deep.equal({
                raw: 'FOO',
                type: 'FOO',
                params: [],
                attributes: []
            });
        });

        it('should pick up on parameters', () => {
            expect(new SqlType('FOO()')).to.deep.equal({
                raw: 'FOO()',
                type: 'FOO',
                params: [],
                attributes: []
            });

            expect(new SqlType('FOO(1)')).to.deep.equal({
                raw: 'FOO(1)',
                type: 'FOO',
                params: ['1'],
                attributes: []
            });

            // Space intentionally omitted between BAR and 2
            expect(new SqlType('FOO(BAR,2, BAZ, 4)')).to.deep.equal({
                raw: 'FOO(BAR,2, BAZ, 4)',
                type: 'FOO',
                params: ['BAR', '2', 'BAZ', '4'],
                attributes: []
            });
        });

        it('should pick up on attributes', () => {
            expect(new SqlType('FOO(1) BAR BAZ QUX')).to.deep.equal({
                raw: 'FOO(1) BAR BAZ QUX',
                type: 'FOO',
                params: ['1'],
                attributes: ['BAR', 'BAZ', 'QUX']
            });
        });

        it('should throw an Error when given input that doesn\'t fit', () => {
            expect(() => new SqlType('')).to.throw(Error);
        });
    });

    describe('tableDataType', () => {
        it('should return a general data type', () => {
            const expectations: { [tableDataType: string]: string[] } = {
                boolean: [
                    'TINYINT(1)',
                    'BIT(1)',
                    'BOOL',
                    'BOOLEAN'
                ],
                integer: [
                    'TINYINT',
                    'TINYINT(2)',
                    'SMALLINT',
                    'MEDIUMINT',
                    'INT',
                    'BIGINT',
                    'YEAR'
                ],
                float: [
                    'DECIMAL',
                    // Next 3 are synonyms for DECIMAL
                    'DEC',
                    'NUMERIC',
                    'FIXED',

                    'DOUBLE',
                    'FLOAT'
                ],
                date: [
                    'DATE'
                ],
                datetime: [
                    'DATETIME',
                    'TIMESTAMP'
                ],
                time: [
                    'TIME'
                ],
                string: [
                    'CHAR',
                    'CHARACTER',
                    'NCHAR',
                    'VARCHAR',
                    'TEXT',
                    'MEDIUMTEXT',
                    'LONGTEXT'
                ],
                blob: [
                    // Could be wrong about these two, but it's fine for now
                    'BINARY',
                    'VARBINARY',
                    'TINYBLOB',
                    'BLOB',
                    'MEDIUMBLOB',
                    'LONGBLOB',
                ],
                enum: [
                    'ENUM'
                ]
            };

            for (const tableDataType of Object.keys(expectations)) {
                for (const input of expectations[tableDataType]) {
                    expect(new SqlType(input).tableDataType).to.equal(tableDataType);
                }
            }
        });
    });
});
