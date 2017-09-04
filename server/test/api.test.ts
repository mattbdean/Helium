import { expect } from 'chai';
import { Application } from 'express';
import * as _ from 'lodash';
import * as moment from 'moment';

import {
    SqlRow, TableHeader, TableMeta, TableName
} from '../src/common/api';
import { ErrorResponse, PaginatedResponse } from '../src/common/responses';
import { createServer } from '../src/server';

import {
    BLOB_STRING_REPRESENTATION, DATE_FORMAT,
    DATETIME_FORMAT
} from '../../common/constants';
import { TableDao } from '../src/routes/api/tables.queries';
import { RequestContext } from './api.test.helper';

////////////////////////////////////////////////////////////////////////////////
// NB: These tests assume that init.sql was run successfully
////////////////////////////////////////////////////////////////////////////////

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
    '#test_lookup',
    '_test_imported',
    '__test_computed'
];

const randomInt = () => Math.round((Math.random() * 10000000));

const SHOWCASE_TABLE = 'datatypeshowcase';

describe('API v1', () => {
    let app: Application;
    let request: RequestContext;

    before('create app', () => {
        app = createServer();
        request = new RequestContext(app);
    });

    describe('GET /api/v1/*', () => {
        it('should 404 with JSON data', () =>
            request.basic('/foobar', 404, (error) => {
                expect(error.message).to.exist;
                expect(error.input).to.deep.equal({});
            })
        );
    });

    describe('GET /api/v1/tables', () => {
        it('should return an array of TableNames', () => {
            return request.basic('/tables', 200, (data: TableName[]) => {
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
            });
        });
    });

    describe('GET /api/v1/tables/:name/data', () => {
        let meta: TableMeta;

        before(async () => {
            meta = await TableDao.meta(SHOWCASE_TABLE);
        });

        it('should return an array of SqlRows', () => {
            return request.spec({
                method: 'GET',
                relPath: '/tables/' + SHOWCASE_TABLE + '/data',
                expectedStatus: 200,
                validate: (response: PaginatedResponse<SqlRow[]>) => {
                    expect(response.size).to.equal(response.data.length);
                    expect(response.size).to.be.above(0);

                    // Find the names of all headers with the type 'blob'
                    const blobRows = _(meta.headers)
                        .filter((h) => h.type === 'blob')
                        .map((h) => h.name)
                        .value();
                    expect(blobRows).to.have.length.above(0);

                    for (const row of response.data) {
                        expect(Object.keys(row)).to.have.lengthOf(meta.headers.length);

                        for (const header of meta.headers) {
                            expect(row[header.name]).to.not.be.undefined;
                        }

                        for (const blobRow of blobRows) {
                            expect(row[blobRow]).to.equal(BLOB_STRING_REPRESENTATION);
                        }
                    }
                }
            });
        });

        it('should support limiting via query', () => {
            return request.spec({
                method: 'GET',
                relPath: '/tables/' + SHOWCASE_TABLE + '/data',
                expectedStatus: 200,
                query: { limit: "2" },
                validate: (response: PaginatedResponse<SqlRow[]>) => {
                    expect(response.size).to.be.at.most(2);
                }
            });
        });

        it('should support sorting via query', async () => {
            const expectOrderedBy = (data: SqlRow[], property: string, order: 'asc' | 'desc') => {
                // This could fail if we're dealing with date types since
                // dates are serialized to strings, and those don't have the
                // same natural order as Date objects
                expect(data).to.deep.equal(_.orderBy(data, [property], [order]));
            };

            // Use the most complex table without any dates for this specific
            // test
            const table = 'product';
            const tableMeta = await TableDao.meta(table);

            const doRequest = (header: TableHeader, sort: 'asc' | 'desc'): Promise<void> =>
                request.spec({
                    method: 'GET',
                    relPath: `/tables/${table}/data`,
                    expectedStatus: 200,
                    // sort ascending with sort=name, descending with sort=-name
                    query: { sort: (sort === 'desc' ? '-' : '') + header.name },
                    validate: (response: PaginatedResponse<SqlRow[]>) => {
                        expect(response.data.length).to.be.above(0);
                        expectOrderedBy(response.data, header.name, sort);
                    }
                });

            for (const header of tableMeta.headers) {
                // Test both ascending and descending
                await doRequest(header, 'asc');
                await doRequest(header, 'desc');
            }
        });

        it('should throw a 400 when sorting by a column that doesn\'t exist', async () => {
            return request.spec({
                method: 'GET',
                relPath: `/tables/${encodeURIComponent(SHOWCASE_TABLE)}/data`,
                query: { sort: 'foobar' },
                expectedStatus: 400,
                validate: (err: ErrorResponse) => {
                    expect(err.input).to.deep.equal({ sort: 'foobar' });
                }
            });
        });
    });

    describe('PUT /api/v1/tables/:name/data', () => {
        /**
         * Attempts to insert some data into the table via the API.
         *
         * `createData` is called with a pseudo-random positive integer to
         * generate the data to be inserted. An optional `validate` parameter is
         * provided to optionally validate the response.
         */
        const tryInsert = (table: string,
                           expectedStatus: number,
                           createData: (randomId: number) => any,
                           validate: (dataOrError: any) => void = () => void 0): Promise<any> => {
            const randomId = randomInt();
            return request.spec({
                method: 'PUT',
                relPath: `/tables/${table}/data`,
                expectedStatus,
                data: createData(randomId),
                validate
            });
        };

        let lastPk: number;

        const createSampleData = (): SqlRow => {
            if (lastPk === undefined)
                // Generate base PK in the range [100..10,000,000]
                lastPk = 100 + randomInt();
            return {
                pk: lastPk++,
                // integer must be unique, create a pseudo-random value for it
                integer: Math.round(10000000 * Math.random()),
                double: 101.444,
                boolean: !!Math.round(Math.random()),
                date: moment().format(DATE_FORMAT), // now
                time: moment(1498515312000).format(DATETIME_FORMAT), // some time in the past
                enum: 'a',
                blob: null,
                string: 'foo',
                string_not_null: 'not null string'
            };
        };

        const insertAndRetrieve = async (data: SqlRow): Promise<SqlRow> => {
            await request.spec({
                method: 'PUT',
                relPath: `/tables/${SHOWCASE_TABLE}/data`,
                expectedStatus: 200,
                data
            });

            const res = await request.spec({
                method: 'GET',
                relPath: `/tables/${SHOWCASE_TABLE}/data`,
                expectedStatus: 200,
                query: { limit: '100', sort: '-pk' }
            });

            const body: PaginatedResponse<SqlRow[]> = res.body;
            const fromDb = _.find(body.data, (row) => row.pk === data.pk);
            expect(fromDb).to.exist;
            return fromDb!!;
        };

        it('should insert new data', async () => {
            const data = createSampleData();

            const fromDb = await insertAndRetrieve(data);
            expect(fromDb).to.exist;
            // Make sure it preserves the primary key
            expect(fromDb.foo_pk).to.equal(data.foo_pk);

            // Make sure dates and times don't get jumbled and that the API
            // returns dates and times in the format they're accepted in
            expect(fromDb.date).to.equal(data.date);
            expect(fromDb.time).to.equal(data.time);
        });

        it('should allow the user to insert blob data', () => {
            const data = createSampleData();
            data.blob = 'foo';

            return request.spec({
                method: 'PUT',
                relPath: `/tables/${SHOWCASE_TABLE}/data`,
                expectedStatus: 400,
                data,
                validate: (err: ErrorResponse) => {
                    expect(err.message).to.include('blob');
                }
            });
        });

        it('shouldn\'t allow specifying unknown columns', () => {
            return tryInsert('customer', 400, (randomId) => ({
                customer_id: randomId,
                name: 'Joe Smith',
                other: 42 // this column doesn't exist
            }), (error: ErrorResponse) => {
                expect(error.message).to.include('other');
            });
        });

        it('shouldn\'t allow the user to insert any data into a table with a non-null blob column', () => {
            return request.spec({
                method: 'PUT',
                relPath: `/tables/blob_test/data`,
                expectedStatus: 400,
                data: {
                    pk: randomInt(),
                    blob_nullable: null,
                    blob_not_null: 'hello'
                },
                validate: (err: ErrorResponse) => {
                    expect(err.message).to.include('blob');
                }
            });
        });

        it('shouldn\'t allow the user to submit data to a table that doesn\'t exist', () => {
            return request.spec({
                method: 'PUT',
                relPath: '/tables/blablabla/data',
                expectedStatus: 404,
                data: {}
            });
        });

        it('should support inserting part table data as well', async () => {
            const partIds = [randomInt(), randomInt()];

            await tryInsert('master', 200, (masterPk) => ({
                pk: masterPk,
                $parts: {
                    part: [
                        { part_pk: partIds[0], master: masterPk },
                        { part_pk: partIds[1], master: masterPk }
                    ]
                }
            }));

            // Query the part table and make sure both were inserted
            const content = await TableDao.content('master__part', 1, 1000);

            for (const partId of partIds) {
                expect(_.find(content, (row) => row['part_pk'] === partId)).to.exist;
            }
        });

        it('should disallow specifically entering data into a part table', () => {
            return tryInsert('master__part', 400, (randomId) => ({
                part_pk: randomId,
                master: randomId + 1
            }), (error: ErrorResponse) => {
                expect(error.message).to.include('part table');
            });
        });

        it('should disallow entering part tables that don\'t reference the master table PK', () => {
            return tryInsert('master', 400, (masterPk) => ({
                pk: masterPk,
                $parts: {
                    part: [
                        { part_pk: randomInt(), master: randomInt() }
                    ]
                }
            }));
        });

        it('shouldn\'t allow inserting data where the column name is $parts', () => {
            return tryInsert('column_name_test', 400, (masterPk) => ({
                // This table's only column is its primary key whose name is '$parts'
                $parts: masterPk
            }), (error: ErrorResponse) => {
                expect(error.message).to.contain('not allowed');
            });
        });

        it('should dissalow specifying $parts when the master table has no part tables', () => {
            return tryInsert('customer', 400, (randomId) => ({
                customer_id: randomId,
                name: 'Some Guy',
                $parts: []
            }));
        });
    });

    describe('GET /api/v1/tables/:name', () => {
        let meta: TableMeta;
        before(async () => {
            meta = (await request.basic(`/tables/${SHOWCASE_TABLE}`, 200)).body;
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
                tableName: SHOWCASE_TABLE
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
                tableName: SHOWCASE_TABLE
            });
        });

        it('should include the total amount of rows', () =>
            request.spec({
                method: 'GET',
                expectedStatus: 200,
                relPath: '/tables/' + SHOWCASE_TABLE + '/data',
                query: { limit: "100" },
                validate: (result: PaginatedResponse<SqlRow[]>) => {
                    // This will fail if we have more than 100 rows
                    expect(result.size).to.equal(meta.totalRows);
                }
            })
        );

        it('should include an array of Constraints', () => {
            return request.basic(`/tables/order`, 200, (res: TableMeta) => {
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
            await request.basic('/tables/shipment', 200, (data: TableMeta) => {
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

            await request.basic('/tables/organization', 200, (data: TableMeta) => {
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
            await request.basic('/tables/organization', 200, (data: TableMeta) => {
                expect(data.comment).to.equal('');
            });

            await request.basic(`/tables/${SHOWCASE_TABLE}`, 200, (data: TableMeta) => {
                expect(data.comment).to.equal('a table with diverse data');
            });
        });

        it('should 404 when given a non-existent table', () =>
            request.basic('/tables/foobar', 404, (error: ErrorResponse) => {
                expect(error.input).to.deep.equal({ name: 'foobar' });
                expect(error.message).to.be.a('string');
            })
        );
    });

    describe('GET /api/v1/:name/column/:col', () => {
        it('should return distinct values for that column in ABC order', () => {
            return request.basic(`/tables/customer/column/customer_id`, 200, (data: any[]) => {
                expect(data).to.deep.equal([0, 1]);
            });
        });

        it('should 400 when given an invalid table name', () => {
            return request.basic('/tables/blablabla/column/bar', 400);
        });

        it('should 400 when given an invalid column name', () => {
            return request.basic('/tables/foo/column/blablabla', 400);
        });
    });
});
