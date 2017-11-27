import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Schema } from 'joi';
import * as joi from 'joi';
import * as _ from 'lodash';
import * as moment from 'moment';
import { inspect } from 'util';

import { TableHeader } from '../src/common/api';
import { DATE_FORMAT, DATETIME_FORMAT } from '../src/common/constants';
import { TableName } from '../src/common/table-name.class';
import { TableInputValidator } from '../src/routes/api/schemas/schema-input.validator';
import { TableDao } from '../src/routes/api/schemas/schemas.queries';

chai.use(chaiAsPromised);

const expect = chai.expect;

describe('TableInputValidator', () => {
    const asHeader = (data: object) => data as any as TableHeader;

    let validator: TableInputValidator;

    // Returns a string that prints out the entirety of an object
    const fullObj = (obj: any) => inspect(obj, { depth: null });

    const expectValid = (s: Schema, v: any) => {
        const result = s.validate(v);
        if (result.error)
            throw new Error(`Unexpected validation error: value = ${v}, error = ${result.error}`);
    };

    const expectInvalid = (s: Schema, v: any) => {
        const result = s.validate(v);
        if (!result.error)
            throw new Error(`Expected a validation error: value = ${v} (${typeof v})`);
    };

    const SCHEMA = '<schema>';

    describe('validate', () => {
        const testData: { [tableName: string]: TableHeader[] } = {
            // the _ prefix is to make sure that this works with any tier of DJ
            // table, not just a manual table
            _master: [
                asHeader({
                    name: 'pk',
                    type: 'integer'
                }),
                asHeader({
                    name: 'foo',
                    type: 'string',
                    maxCharacters: 5
                }),
                asHeader({
                    name: 'baz',
                    type: 'date',
                    nullable: true
                })
            ],
            _master__part: [
                asHeader({
                    name: 'part_pk',
                    type: 'integer'
                }),
                asHeader({
                    name: 'part_fk',
                    type: 'integer'
                }),
                asHeader({
                    name: 'bar',
                    type: 'string',
                    maxCharacters: 10
                })
            ],
            // A part table of some other table. We don't necessarily care about
            // its master.
            _other__part: [ asHeader({ name: 'pk', type: 'integer' }) ]
        };

        // These functions are for when we don't care about what data we're
        // testing, as long as it adheres to the constraints defined by the
        // headers we've created
        const validMasterInput = () => ({
            pk: '1234',
            foo: 'abc',
            baz: '2017-01-01'
        });
        const validPartInput = () => ({
            part_pk: 0,
            part_fk: 1234,
            bar: 'foobar'
        });

        beforeEach(() => {
            // Mirror the functionality of a real TableDao. Instead of looking
            // up data from a database, we're working with fake metadata (defined above).
            const fakeDao = {
                headers: async (schema: string, name: string): Promise<TableHeader[]> => {
                    const headers = testData[name];
                    if (!headers)
                        throw new Error(`Table ${name} does not exist`);

                    return headers;
                }
            } as any as TableDao;
            validator = new TableInputValidator(fakeDao);
        });

        it('should require an object', async () => {
            for (const invalidInput of [null, undefined, 0, true, false])
                await expect(validator.validate(SCHEMA, invalidInput)).to.be.rejectedWith(Error);
        });

        it('should return the validated data in their proper types', async () => {
            // pk should be converted from a string to a number
            const input = {
                _master: [{
                    pk: '1234',
                    foo: 'abcd',
                    baz: '2017-01-01'
                }]
            };

            expect(await validator.validate(SCHEMA, input)).to.deep.equal({
                _master: [{
                    pk: 1234, // the string '1234' should be converted to a number
                    foo: 'abcd',
                    baz: '2017-01-01' // dates already in the right format should
                                      // remain like that
                }]
            });
        });

        it('should allow master tables and part tables to be specified in the same object', () => {
            const input = {
                _master: [ validMasterInput() ],
                _master__part: [ validPartInput() ]
            };

            // Make sure it doesn't throw an error
            return validator.validate(SCHEMA, input);
        });

        it('should not allow part tables by itself', () => {
            const input = {
                _master__part: [{
                    part_pk: 0,
                    part_fk: 0,
                    bar: 'abc'
                }]
            };

            return expect(validator.validate(SCHEMA, input)).to.be.rejectedWith(Error);
        });

        it('should reject non-existent tables', () => {
            const input = {
                unknown_table: [{ foo: 123 }]
            };

            return expect(validator.validate(SCHEMA, input)).to.be.rejectedWith(Error);
        });

        it('should ensure that all part tables belong to the master table', () => {
            const input = {
                _master: [ validMasterInput() ],
                _other__part: [ { pk: 0 } ]
            };

            return expect(validator.validate(SCHEMA, input)).to.be.rejectedWith(Error);
        });

        it('should allow exactly one master table input and zero or more part table inputs', async () => {
            /**
             * Creates an input object that specifies `params.master` master
             * entries and `params.part` part entries
             */
            const createInput = (params: { master: number, part: number }) => ({
                _master: _.range(params.master).map(validMasterInput),
                _master__part: _.range(params.part).map(validPartInput)
            });

            // Define what combinations of number of master/part entries are valid
            // Valid inputs have exactly 1 master entry and 0 or more part entries
            const valid = _.range(3).map((n) => ({ master: 1, part: n }));

            // Invalid inputs have any other number of master entries besides 1.
            // The number of part entries should be irrelevant but vary just in
            // case.
            const invalid = [
                { master: 0, part: 0 },
                { master: 0, part: 1 },
                { master: 2, part: 0 },
                { master: 3, part: 1 }
            ];

            for (const inputShape of valid) {
                await validator.validate(SCHEMA, createInput(inputShape));
            }

            for (const inputShape of invalid) {
                await expect(validator.validate(SCHEMA, createInput(inputShape)))
                    .to.be.rejectedWith(Error);
            }
        });
    });

    describe('schemaForTableArray', () => {
        const headers = [asHeader({ name: 'foo', type: 'integer', signed: true })];
        const entry = () => ({ foo: 1 });

        it('should allow exactly 1 entry for master tables', () => {
            // '#' prefix chosen at random
            const tableName = new TableName('#foo');

            const schema = TableInputValidator.schemaForTableArray(headers, tableName);

            // Invalid inputs are anything but 1 entry
            const invalid = [
                [],
                [ entry(), entry() ]
            ];

            for (const inv of invalid) {
                expect(() => joi.assert(inv, schema)).to.throw(Error);
            }

            // Valid inputs have exactly 1 entry
            joi.assert([entry()], schema);
        });

        it('should allow zero or more entries for part tables', () => {
            const tableName = new TableName('#foo__bar');
            const schema = TableInputValidator.schemaForTableArray(headers, tableName);

            // for (let i = 0; i < 3; i++) {
            //     const input = _.range(i).map(entry);
            //     console.log(input);
            //     joi.assert(input, schema);
            // }
            joi.assert([], schema);
        });

        // it.only('foo', () => {
        //     // const schema = TableInputValidator.schemaForTable(headers);
        //     // console.log(schema.validate(entry()));
        //
        //     const schema = TableInputValidator.schemaForTableArray(headers, new TableName('#foo__bar'));
        //     console.log(new TableName('foo__bar').isPartTable());
        //     // console.log(schema.validate(_.range(3).map(entry)));
        //     console.log(schema.validate([]));
        // });
    });

    describe('schemaForTable', () => {
        const generateHeaders = (numHeaders: number) =>
            _.range(numHeaders).map((n) => (asHeader({
                name: 'header' + n,
                type: 'string',
                maxCharacters: 10
            })));

        it('should only allow objects', () => {
            const invalid = [null, undefined, 0, new Date(), {}, true, false];

            // Generate N textual headers named header{i} where `i` is an
            // integer from 0 to n
            const headers = generateHeaders(1);

            // .required() disallows undefined values
            const schema = TableInputValidator.schemaForTable(headers).required();

            for (const v of invalid)
                expectInvalid(schema, v);

            expectValid(schema, { header0: 'foo' });
        });

        it('should not allow unknown keys in the object', () => {
            // Create a schema with 2 textual columns: header0 and header1
            const schema = TableInputValidator.schemaForTable(generateHeaders(2));

            // Specifying an object with keys matching the header names exactly
            // is fine
            const valid = { header0: 'foo', header1: 'bar' };
            expectValid(schema, valid);

            // Trying to add some unknown key into the object should make it invalid
            const invalid: any = _.clone(valid);
            invalid.other = 'baz';

            expectInvalid(schema, invalid);
        });

        it('should throw an error if given an empty header array', () => {
            expect(() => TableInputValidator.schemaForTable([])).to.throw(Error);
        });
    });

    describe('schemaForHeader', () => {
        // A list of values that a user might try to insert into the DB
        const potentialInputs = [
            null,
            undefined,
            true,
            false,
            'true',
            'false',
            '1234',
            '123467890',
            'a', 'b', 'c', // enum values
            'abc123',
            '2016-11-01',
            '1994-03-22',
            '2000-02-29', // invalid date
            '2017-01-01 23:11:34',
            '1955-09-30 00:00:00',
            // Create integers from 10^0 up to 10^10
            ..._.range(11).map((n) => n * Math.pow(10, n)),
            // Add negative numbers into the mix
            ..._.range(11).map((n) => -n * Math.pow(10, n)),
            // Create floats from 10^0 as small as 10^-10
            ..._.range(11).map((n) => n * Math.pow(10, -n)),
            Infinity,
            -Infinity
        ];

        /**
         * Tests that the schema generated by the given TableHeader stub
         * correctly validates some input. Some value `v` is required to be a
         * valid input for the generated schema if `shouldBeValid(v)` returns
         * a truthy value. If the function returns a falsy value, a validation
         * error must be thrown when the schema tests that value.
         */
        const testSchemaGen = (headerStub: object, shouldBeValid: (val: any) => boolean) => {
            const schema = TableInputValidator.schemaForHeader(asHeader(headerStub));

            // Split potentialInputs into two arrays, one containing the
            // elements that should be valid and those that should not
            const [valid, invalid] = _.partition(potentialInputs, shouldBeValid);

            for (const v of valid) {
                const result = schema.validate(v);
                if (result.error)
                    throw new Error(`Unexpected validation error: headerStub = ` +
                        `${fullObj(headerStub)}, value = ${v}, error = ${result.error}`);
            }

            for (const inv of invalid) {
                const result = schema.validate(inv);
                if (!result.error)
                    throw new Error(`Expected a validation error: headerStub = ` +
                        `${fullObj(headerStub)}, value = ${inv} (${typeof inv})`);
            }
        };

        const isNumeric = (v) => (typeof v === 'string' && !isNaN(v as any)) ||
            typeof v === 'number';

        it('should handle strings with character limits', () => {
            testSchemaGen({ type: 'string', maxCharacters: 5 },
                (v) => typeof v === 'string' && v.length <= 5);
        });

        it('should handle signed integers', () => {
            testSchemaGen({ type: 'integer', signed: true },
                (v) => isNumeric(v) && Number.isInteger(parseFloat(v)));
        });

        it('should handle signed floats', () => {
            testSchemaGen({ type: 'float', signed: true },
                (v) => isNumeric(v) && Number.isFinite(parseFloat(v)));
        });

        it('should handle unsigned integers', () => {
            testSchemaGen({ type: 'integer', signed: false },
                (v) => isNumeric(v) && Number.isInteger(parseFloat(v)) && parseInt(v, 10) >= 0);
        });

        it('should handle unsigned floats', () => {
            testSchemaGen({ type: 'float', signed: false },
                (v) => isNumeric(v) && parseInt(v, 10) >= 0);
        });

        it('should handle dates', () => {
            testSchemaGen({ type: 'date' }, (v) =>
                // joi-date-extensions accepts numbers as valid date inputs as
                // well as properly-formatted dates
                (typeof v === 'number' && Number.isFinite(v)) ||
                // 3rd paramter in moment() is 'strict mode'
                (typeof v === 'string' && moment(v, DATE_FORMAT, true).isValid()));
        });

        it('should handle datetimes', () => {
            testSchemaGen({ type: 'datetime' }, (v) =>
                // joi-date-extensions accepts numbers as valid date inputs as
                // well as properly-formatted dates
                (typeof v === 'number' && Number.isFinite(v)) ||
                // 3rd paramter in moment() is 'strict mode'
                (typeof v === 'string' && moment(v, DATETIME_FORMAT, true).isValid()));
        });

        it('should handle booleans', () => {
            testSchemaGen({ type: 'boolean' },
                (v) => typeof v === 'boolean' || v === 'true' || v === 'false');
        });

        it('should handle enums', () => {
            testSchemaGen({ type: 'enum', enumValues: ['a', 'b', 'c']},
                (v) => v === 'a' || v === 'b' || v === 'c');
        });

        it('should handle non-nullable blobs', () => {
            testSchemaGen({ type: 'blob', nullable: false },
                // All inputs are invalid for a non-nullable blob
                (v) => false);
        });

        it('should handle nullable blobs', () => {
            testSchemaGen({ type: 'blob', nullable: true },
                (v) => v === null || v === undefined);
        });
    });
});
