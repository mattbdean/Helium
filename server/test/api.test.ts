import { expect } from 'chai';
import { Application } from 'express';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Response } from 'supertest';

import {
    Constraint, ErrorResponse, PaginatedResponse, SqlRow,
    TableHeader, TableMeta
} from '../src/common/responses';
import {
    fetchConstraints,
    fetchTableCount,
    fetchTableHeaders
} from '../src/routes/api/v1/tables';
import { createServer } from '../src/server';

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
    'datatypeshowcase'
];

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
        it('should return an array of strings', () => {
            return request.basic('/tables', 200, (data: string[]) => {
                expect(Array.isArray(data)).to.be.true;
                expect(data).to.deep.equal(_.sortBy(ALL_TABLES));
            });
        });
    });

    describe('GET /api/v1/tables/:name', () => {
        let meta: TableMeta;

        before(async () => {
            meta = await fetchMetadata(SHOWCASE_TABLE);
        });

        it('should return an array of SqlRows', () => {
            return request.spec({
                method: 'GET',
                relPath: '/tables/' + SHOWCASE_TABLE,
                expectedStatus: 200,
                validate: (response: PaginatedResponse<SqlRow[]>) => {
                    expect(response.size).to.equal(response.data.length);
                    expect(response.size).to.be.above(0);
                    for (const row of response.data) {
                        expect(Object.keys(row)).to.have.lengthOf(meta.headers.length);

                        for (const header of meta.headers) {
                            expect(row[header.name]).to.not.be.undefined;
                        }
                    }
                }
            });
        });

        it('should support limiting via query', () => {
            return request.spec({
                method: 'GET',
                relPath: '/tables/' + SHOWCASE_TABLE,
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
            const tableMeta = await fetchMetadata(table);

            const doRequest = (header: TableHeader, sort: 'asc' | 'desc'): Promise<void> =>
                request.spec({
                    method: 'GET',
                    relPath: `/tables/${table}`,
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
                relPath: `/tables/${encodeURIComponent(SHOWCASE_TABLE)}`,
                query: { sort: 'foobar' },
                expectedStatus: 400,
                validate: (err: ErrorResponse) => {
                    expect(err.input).to.deep.equal({ sort: 'foobar' });
                }
            });
        });
    });

    describe('PUT /api/v1/tables/:name', () => {
        let lastPk;
        const createSampleData = (): SqlRow => {
            if (lastPk === undefined)
                // Generate base PK in the range [100..10,000,000]
                lastPk = 100 + Math.round((Math.random() * 10000000));
            return {
                pk: lastPk++,
                // integer must be unique, create a random value for it
                integer: Math.round(10000000 * Math.random()),
                double: 101.444,
                boolean: !!Math.round(Math.random()),
                date: new Date(), // now
                time: new Date(1498515312000), // some time in the past
                enum: 'a',
                string: 'foo',
                string_not_null: 'not null string'
            };
        };

        const insertAndRetrieve = async (data: SqlRow): Promise<SqlRow> => {
            await request.spec({
                method: 'PUT',
                relPath: `/tables/${SHOWCASE_TABLE}`,
                expectedStatus: 200,
                data
            });

            const res = await request.spec({
                method: 'GET',
                relPath: `/tables/${SHOWCASE_TABLE}`,
                expectedStatus: 200,
                query: { limit: '100', sort: '-pk' }
            });

            const body: PaginatedResponse<SqlRow[]> = res.body;
            const fromDb = _.find(body.data, (row) => row.foo_pk === data.foo_pk);
            expect(fromDb).to.exist;
            return fromDb!!;
        };

        /**
         * Removes any mention of time from this date. Sets hours, minutes,
         * seconds, and milliseconds to 0 and returns a Moment instance.
         */
        const dateFloor = (date: moment.Moment | Date | string | number): moment.Moment => {
            return moment(date).hours(0).minutes(0).seconds(0).milliseconds(0);
        };

        it('should insert new data', async () => {
            const data = createSampleData();

            const fromDb = await insertAndRetrieve(data);
            expect(fromDb).to.exist;
            // Make sure it preserves the primary key
            expect(fromDb.foo_pk).to.equal(data.foo_pk);
            // Make sure dates and times don't get jumbled

            // MySQL doesn't store any data for time for 'date' columns, so we
            // have to remove any traces of it from the original date before
            // making expectations
            expect(moment(fromDb.date).toISOString())
                .to.equal(dateFloor(data.date).toISOString());

            // Timestamps should have no problem with storing times, so we can
            // compare their values directly as ISO-formatted datetime strings.
            expect(new Date(fromDb.time).toISOString())
                .to.equal(data.time.toISOString());
        });
    });

    describe('GET /api/v1/tables/:name/meta', () => {
        let meta: TableMeta;
        before(async () => {
            const res = await request.basic(`/tables/${SHOWCASE_TABLE}/meta`, 200);
            meta = res.body;
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
                type: 'int',
                ordinalPosition: 1,
                rawType: 'int(11)',
                isNumber: true,
                isTextual: false,
                nullable: false,
                maxCharacters: null,
                charset: null,
                numericPrecision: 10,
                numericScale: 0,
                enumValues: null,
                comment: 'pk column'
            });

            expectHeader('enum', {
                name: 'enum',
                type: 'enum',
                ordinalPosition: 7,
                rawType: `enum('a','b','c')`,
                isNumber: false,
                isTextual: true,
                nullable: true,
                maxCharacters: 1,
                charset: 'utf8',
                numericPrecision: null,
                numericScale: null,
                enumValues: ['a', 'b', 'c'],
                comment: 'enum column'
            });
        });

        it('should include the total amount of rows', () =>
            request.spec({
                method: 'GET',
                expectedStatus: 200,
                relPath: '/tables/' + SHOWCASE_TABLE,
                query: { limit: "100" },
                validate: (result: PaginatedResponse<SqlRow[]>) => {
                    // This will fail if we have more than 100 rows
                    expect(result.size).to.equal(meta.totalRows);
                }
            })
        );

        it('should include an array of Constraints', () => {
            return request.basic(`/tables/order/meta`, 200, (res: TableMeta) => {
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

        it('should resolve FK constraints to the original table', () => {
            return request.basic('/tables/shipment/meta', 200, (data: TableMeta) => {
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
        });

        it('should 404 when given a non-existent table', () =>
            request.basic('/tables/foobar/meta', 404, (error: ErrorResponse) => {
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

    const fetchMetadata = async (table: string): Promise<TableMeta> => {
        const [headers, count, constraints] = await Promise.all([
            fetchTableHeaders(table),
            fetchTableCount(table),
            fetchConstraints(table)
        ]);

        expect(headers).to.have.length.above(0);

        return {
            headers,
            totalRows: count,
            constraints
        };
    };
});
