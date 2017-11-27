import { expect } from 'chai';
import * as _ from 'lodash';

import {
    SqlRow, TableHeader, TableMeta
} from '../../src/common/api';
import { ErrorResponse, PaginatedResponse } from '../../src/common/responses';
import { TableName } from '../../src/common/table-name.class';
import { RequestContext } from '../api.test.helper';
import { setupRequestContext } from './setup';
import { BASE_SCHEMA, SHOWCASE_TABLE } from './shared';

export default function() {
    let request: RequestContext;
    before(async () => {
        request = await setupRequestContext();
    });

    describe('GET /api/v1/schemas/:schema/:table', () => {
        let meta: TableMeta;
        before(async () => {
            meta = (await request.basic(`/schemas/${BASE_SCHEMA}/${SHOWCASE_TABLE}`, 200)).body;
        });

        it('should include table headers', () => {
            expect(meta.headers).to.exist;
            const headers = meta.headers;
            expect(headers).to.have.length.above(0);

            const expectHeader = (name: string, expected: TableHeader) => {
                const actual = _.find(headers, (h) => h.name === name);
                if (actual === undefined)
                    throw new Error(`could not find header with name '${name}'`);
                expect(actual).to.deep.equal(expected);
            };

            // Cherry pick a few headers
            expectHeader('pk', {
                name: 'pk',
                type: 'integer',
                ordinalPosition: 1,
                signed: false,
                rawType: 'int(10) unsigned',
                isNumerical: true,
                isTextual: false,
                nullable: false,
                maxCharacters: null,
                charset: null,
                numericPrecision: 10,
                numericScale: 0,
                enumValues: null,
                comment: 'pk column',
                tableName: SHOWCASE_TABLE,
                defaultValue: null
            });

            expectHeader('enum', {
                name: 'enum',
                type: 'enum',
                ordinalPosition: 7,
                rawType: `enum('a','b','c')`,
                isNumerical: false,
                isTextual: true,
                signed: false,
                nullable: true,
                maxCharacters: 1,
                charset: 'utf8',
                numericPrecision: null,
                numericScale: null,
                enumValues: ['a', 'b', 'c'],
                comment: 'enum column',
                tableName: SHOWCASE_TABLE,
                defaultValue: null
            });
        });

        it('should include the total amount of rows', () =>
            request.spec({
                method: 'GET',
                expectedStatus: 200,
                relPath: `/schemas/${BASE_SCHEMA}/${SHOWCASE_TABLE}/data`,
                query: { limit: '100' },
                validate: (result: PaginatedResponse<SqlRow[]>) => {
                    // This will fail if we have more than 100 rows
                    expect(result.size).to.equal(meta.totalRows);
                }
            })
        );

        it('should include an array of Constraints', () => {
            return request.basic(`/schemas/${BASE_SCHEMA}/order`, 200, (res: TableMeta) => {
                const constraints = res.constraints;
                expect(constraints).to.exist;
                // 4 PK, 3 FK's, 1 unique
                expect(constraints).to.have.lengthOf(8);

                const grouped = _.groupBy(constraints, 'localColumn');
                expect(grouped.confirmation_num).to.deep.equal([{
                    type: 'unique',
                    localColumn: 'confirmation_num',
                    foreignTable: null,
                    foreignColumn: null
                }]);

                // Map column names to the types of their constraints
                const onlyTypes: { [col: string]: string[] } = {};

                for (const col of Object.keys(grouped)) {
                    onlyTypes[col] = _.sortBy(_.map(grouped[col], 'type'));
                }

                // order_id is just a primary key
                expect(onlyTypes.order_id).to.deep.equal(['primary']);

                // These columns are both primary and foreign keys
                const pkAndFk = ['organization_id', 'customer_id', 'product_id'];
                for (const col of pkAndFk)
                    expect(onlyTypes[col]).to.deep.equal(['foreign', 'primary']);

                // confirmation_num is the only unique constraint
                expect(onlyTypes.confirmation_num).to.deep.equal(['unique']);
            });
        });

        it('should resolve FK constraints to the original table', async () => {
            await request.basic(`/schemas/${BASE_SCHEMA}/shipment`, 200, (data: TableMeta) => {
                const grouped = _.groupBy(data.constraints, 'localColumn');
                // order_id has no other containers between `shipment` and its
                // home table
                expect(grouped.order_id).to.deep.equal([{
                    localColumn: 'order_id',
                    type: 'foreign',
                    foreignTable: 'order',
                    foreignColumn: 'order_id'
                }]);

                // organization_id directly references `order,` but
                // originates from `organization`
                expect(grouped.organization_id).to.deep.equal([{
                    localColumn: 'organization_id',
                    type: 'foreign',
                    foreignTable: 'organization',
                    foreignColumn: 'organization_id'
                }]);
            });

            await request.basic(`/schemas/${BASE_SCHEMA}/organization`, 200, (data: TableMeta) => {
                // `organization` is the only table that contains a Constraint
                // where localColumn !== foreignColumn
                const c = data.constraints.find((c2) =>
                    c2.localColumn === 'ceo_id' && c2.type === 'foreign');

                expect(c).to.deep.equal({
                    type: 'foreign',
                    localColumn: 'ceo_id',
                    foreignColumn: 'customer_id',
                    foreignTable: 'customer'
                });
            });
        });

        it('should include a comment when applicable', async () => {
            await request.basic(`/schemas/${BASE_SCHEMA}/organization`, 200, (data: TableMeta) => {
                expect(data.comment).to.equal('');
            });

            await request.basic(`/schemas/${BASE_SCHEMA}/${SHOWCASE_TABLE}`, 200, (data: TableMeta) => {
                expect(data.comment).to.equal('a table with diverse data');
            });
        });

        it('should 404 when given a non-existent table', () =>
            request.basic(`/schemas/${BASE_SCHEMA}/foobar`, 404, (error: ErrorResponse) => {
                expect(error.input).to.deep.equal({ schema: BASE_SCHEMA, table: 'foobar' });
                expect(error.message).to.be.a('string');
            })
        );

        it('should include part table names when applicable', () => {
            // `datatypeshowcase` has no part tables
            expect(meta.parts).to.be.empty;

            request.basic(`/schemas/${BASE_SCHEMA}/master`, 200, (data: TableMeta) => {
                // `master` has 2 part tables: `part` and `part2`
                const expected: TableName[] = [
                    new TableName('master__part'),
                    new TableName('master__part2')
                ];
                expect(data.parts).to.deep.equal(expected);
            });
        });

        it('should include default values for headers', () => {
            return request.basic(`/schemas/${BASE_SCHEMA}/defaults_test`, 200, (data: TableMeta) => {
                const headers = data.headers;

                const expectDefault = (name: string, expectedDefault: any) => {
                    const header = headers.find((h) => h.name === name);
                    if (header === undefined)
                        throw new Error('Could not find header for name ' + name);
                    expect(header.defaultValue).to.deep.equal(expectedDefault);
                };

                const expected = {
                    pk: null,
                    int: 5,
                    float: 10,
                    date: '2017-01-01',
                    datetime: '2017-01-01 12:00:00',
                    datetime_now: { constantName: 'CURRENT_TIMESTAMP' },
                    boolean: true,
                    enum: 'a',
                    no_default: null
                };

                for (const headerName of Object.keys(expected)) {
                    expectDefault(headerName, expected[headerName]);
                }
            });
        });
    });
}
