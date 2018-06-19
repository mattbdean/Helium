import { Validators } from '@angular/forms';
import { expect } from 'chai';
import { CompoundConstraint, TableHeader, TableMeta } from '../../common/api';
import { flattenCompoundConstraints } from '../../common/util';
import { TableService } from '../../core/table/table.service';
import { FormControlSpec } from '../form-control-spec';
import { FormSpecGeneratorService } from './form-spec-generator.service';

/** Special interface to make creating actual textual TableHeader instances easier */
interface TextualHeaderStub {
    name: string;
    nullable?: boolean;
    maxCharacters?: number | undefined;
    enumValues?: string[] | null;
    defaultValue?: any;
}

interface NumericHeaderStub {
    name: string;
    type: 'float' | 'integer';
    nullable?: boolean;
}

const tableName = 'foo';

const createMetaFor = (headers: TableHeader[], constraints: CompoundConstraint[] = []): TableMeta => ({
    schema: 'foo',
    name: tableName,
    headers,
    totalRows: -1,
    constraints,
    comment: 'comment',
    parts: []
});

const textualHeader = (h: TextualHeaderStub): TableHeader => {
    const maxCharacters = h.maxCharacters === undefined ? null : h.maxCharacters;
    const nullable = h.nullable !== undefined ? h.nullable : true;

    return {
        name: h.name,
        type: h.enumValues ? 'enum' : 'string',
        rawType: 'mock string',
        isNumerical: false,
        isTextual: true,
        ordinalPosition: -1,
        signed: false,
        nullable,
        maxCharacters,
        charset: 'UTF-8',
        numericPrecision: null,
        numericScale: null,
        enumValues: h.enumValues || null,
        comment: '',
        tableName,
        defaultValue: h.defaultValue
    };
};

const numericHeader = (h: NumericHeaderStub): TableHeader => {
    const nullable = h.nullable !== undefined ? h.nullable : true;
    return {
        name: h.name,
        type: h.type,
        rawType: 'mock int',
        isNumerical: true,
        isTextual: false,
        ordinalPosition: -1,
        signed: true,
        nullable,
        maxCharacters: null,
        charset: null,
        numericPrecision: 10, // TODO
        numericScale: 5,
        enumValues: null,
        comment: '',
        tableName,
        defaultValue: null
    };
};

describe('FormSpecGeneratorService', () => {
    let generator: FormSpecGeneratorService;

    beforeEach(() => {
        // Mock this if necessary
        const tableService: TableService = {} as TableService;
        generator = new FormSpecGeneratorService(tableService);
    });

    const generateSingle = (header: TableHeader) => {
        const meta = createMetaFor([header]);
        return generator.generate(meta)[0];
    };

    describe('generate', () => {
        it('should handle the simplest possible table', () => {
            const formSpec = generateSingle(textualHeader({ name: 'bar', nullable: true }));

            const expected: FormControlSpec = {
                type: 'text',
                subtype: 'text',
                formControlName: 'bar',
                placeholder: 'bar',
                validation: [],
                required: false,
                disabled: false,
                hoverHint: 'mock string'
            };
            expect(formSpec).to.deep.equal(expected);
        });

        it('should make non-null headers required', () => {
            const formSpec = generateSingle(textualHeader({ name: 'bar', nullable: false }));

            const expected: FormControlSpec = {
                type: 'text',
                subtype: 'text',
                formControlName: 'bar',
                placeholder: 'bar',
                validation: [Validators.required],
                required: true,
                disabled: false,
                hoverHint: 'mock string'
            };
            expect(formSpec).to.deep.equal(expected);
        });

        it('should handle maxCharacters', () => {
            const formSpec = generateSingle(textualHeader({ name: 'bar', maxCharacters: 5 }));

            // Deep equal comparison doesn't work on functions created dynamically.
            // For example:
            //
            // function foo() {
            //   return function() {}
            // }
            //
            // expect(foo()).to.not.deep.equal(foo())
            //
            // Since the other tests verify that all other properties are as
            // expected, we can focus on just the validation
            expect(formSpec.validation).to.have.lengthOf(1);
        });

        it('should handle numeric headers', () => {
            const types: Array<'float' | 'integer'> = ['float', 'integer'];

            for (const type of types) {
                const formSpec = generator.generate(createMetaFor(
                    [numericHeader({ name: 'bar', type })]
                ))[0];

                expect(formSpec.subtype).to.equal('number');
            }
        });

        it('should handle enumerated values', () => {
            const enumValues = ['one', 'two', 'three'];
            const formSpec = generateSingle(textualHeader({ name: 'bar', enumValues }));

            const expected: FormControlSpec = {
                type: 'enum',
                formControlName: 'bar',
                placeholder: 'bar',
                validation: [],
                enumValues,
                required: false,
                disabled: false,
                hoverHint: 'mock string'
            };

            expect(formSpec).to.deep.equal(expected);
        });

        it('should handle boolean values', () => {
            const formSpec = generateSingle({
                name: 'bar',
                type: 'boolean',
                nullable: false,
            } as TableHeader);

            expect(formSpec.validation!!).to.have.lengthOf(0);
            expect(formSpec.type).to.equal('boolean');
            expect(formSpec.defaultValue!!).to.be.false;
        });

        it('should handle dates', () => {
            const formSpec = generateSingle({
                name: 'bar',
                type: 'date'
            } as TableHeader);

            expect(formSpec.type).to.equal('date');
        });

        it('should handle datetimes', () => {
            const formSpec = generateSingle({
                name: 'bar',
                type: 'datetime'
            } as TableHeader);

            expect(formSpec.type).to.equal('datetime');
        });

        it('should handle blobs', () => {
            const formSpecNullable = generateSingle({
                name: 'bar',
                type: 'blob',
                nullable: true
            } as TableHeader);

            expect(formSpecNullable.type).to.equal('text');
            expect(formSpecNullable.defaultValue).to.be.null;
            expect(formSpecNullable.disabled!!).to.be.true;

            // The only difference specifying nullable: false is that the
            // initial value is undefined instead of null.
            const formSpecNonNull = generateSingle({
                name: 'bar',
                type: 'blob',
                nullable: false
            } as TableHeader);

            expect(formSpecNonNull.type).to.equal('text');
            expect(formSpecNonNull.defaultValue).to.be.null;
            expect(formSpecNonNull.disabled).to.be.true;
        });
    });

    describe('bindingConstraints', () => {
        it('should throw an error if the given part tables aren\'t actually ' + '' +
            'part tables of the master', () => {
            const mockMeta = { name: 'bar__part' } as TableMeta;
            expect(() => { generator.bindingConstraints('foo', mockMeta ); }).to.throw(Error);
        });

        it('should pick out FK constraints', () => {
            const schema = 'schema';
            const mockMeta = {
                name: 'master__part',
                constraints: [
                    // throw in two FK constraints that reference master
                    {
                        name: 'master__part_ibfk_1',
                        type: 'foreign',
                        constraints: [{
                            ref: {
                                schema,
                                column: 'part_fk1',
                                table: 'master'
                            },
                            localColumn: 'part_fk1',
                            type: 'foreign'
                        }]
                    },
                    {
                        name: 'master__part_ibfk_2',
                        type: 'foreign',
                        constraints: [{
                            localColumn: 'part_fk2',
                            ref: {
                                schema,
                                table: 'master',
                                column: 'master_pk2'
                            },
                            type: 'foreign'
                        }]
                    },
                    // should not be included since it's a unique constraint and
                    // not a FK constraint
                    {
                        name: 'part_unique',
                        type: 'unique',
                        constraints: [{
                            localColumn: 'part_unique',
                            type: 'unique',
                            ref: null
                        }]
                    },
                    // should not be included since it's a FK that references a
                    // table that isn't the master table
                    {
                        name: 'master__part_ibfk3',
                        type: 'foreign',
                        constraints: [{
                            localColumn: 'part_fk3',
                            ref: {
                                schema,
                                table: 'not_master',
                                column: 'foo'
                            },
                            type: 'foreign'
                        }]
                    }
                ]
            } as TableMeta;

            const expected = flattenCompoundConstraints(mockMeta.constraints)
                .filter((c) => c.type === 'foreign' && c.ref !== null && c.ref.table === 'master');

            expect(generator.bindingConstraints('master', mockMeta)).to.deep
                .equal(expected);
        });
    });
});
