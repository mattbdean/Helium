import { expect } from 'chai';
import { Application } from 'express';
import * as _ from 'lodash';
import * as moment from 'moment';
import { Response } from 'supertest';

import {
    ErrorResponse, PaginatedResponse, SqlRow,
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

const PRIMARY_TABLE = 'foo';
const SECONDARY_TABLES = ['bar', 'baz'];

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
                expect(data).to.deep.equal(_.sortBy([PRIMARY_TABLE, ...SECONDARY_TABLES]));
            });
        });
    });

    describe('GET /api/v1/tables/:name', () => {
        let meta: TableMeta;

        beforeEach(async () => {
            meta = await fetchMetadata(PRIMARY_TABLE);
        });

        it('should return an array of SqlRows', () => {
            return request.spec({
                method: 'GET',
                relPath: '/tables/' + PRIMARY_TABLE,
                expectedStatus: 200,
                validate: (response: PaginatedResponse<SqlRow[]>) => {
                    expect(response.size).to.equal(response.data.length);
                    expect(response.size).to.be.above(0);
                    for (const row of response.data) {
                        expect(Object.keys(row)).to.have.lengthOf(meta.headers.length);

                        for (const header of meta.headers) {
                            expect(row[header.name]).to.exist;
                        }
                    }
                }
            });
        });

        it('should support limiting via query', () => {
            return request.spec({
                method: 'GET',
                relPath: '/tables/' + PRIMARY_TABLE,
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

            const doRequest = (header: TableHeader, sort: 'asc' | 'desc'): Promise<void> =>
                request.spec({
                    method: 'GET',
                    relPath: `/tables/${encodeURIComponent(PRIMARY_TABLE)}`,
                    expectedStatus: 200,
                    // sort ascending with sort=name, descending with sort=-name
                    query: { sort: (sort === 'desc' ? '-' : '') + header.name },
                    validate: (response: PaginatedResponse<SqlRow[]>) => {
                        expect(response.data.length).to.be.above(0);
                        expectOrderedBy(response.data, header.name, sort);
                    }
                });

            for (const header of meta.headers) {
                // Test both ascending and descending
                await doRequest(header, 'asc');
                await doRequest(header, 'desc');
            }
        });

        it('should throw a 400 when sorting by a column that doesn\'t exist', async () => {
            return request.spec({
                method: 'GET',
                relPath: `/tables/${encodeURIComponent(PRIMARY_TABLE)}`,
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
                foo_pk: lastPk++,
                integer: 100,
                double: 101,
                boolean: true,
                date: new Date(), // now
                time: new Date(1498515312000), // some time in the past
                enum: 'a',
                string: 'foo',
                // Default to valid values for bar and baz
                bar: 0,
                baz: 1
            };
        };

        const insertAndRetrieve = async (data: SqlRow): Promise<SqlRow> => {
            await request.spec({
                method: 'PUT',
                relPath: `/tables/foo`,
                expectedStatus: 200,
                data
            });

            const res = await request.spec({
                method: 'GET',
                relPath: `/tables/foo`,
                expectedStatus: 200,
                query: { limit: '100', sort: '-foo_pk' }
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
        it('should return the table metadata', async () => {
            const res = await request.spec({
                method: 'GET',
                relPath: `/tables/${PRIMARY_TABLE}/meta`,
                expectedStatus: 200
            });

            const meta: TableMeta = res.body;
            expect(Array.isArray(meta.headers)).to.be.true;
            expect(meta.headers).to.have.length.above(0);

            const findHeader = (name: string): TableHeader =>
                _.find(meta.headers, (h) => h.name === name)!!;

            const expectHeader = (name: string, type: 'textual' | 'numerical' | 'enum') => {
                const h = findHeader(name);
                expect(h).to.exist;

                const isNum = type === 'numerical';
                expect(h.isNumber).to.equal(isNum);
                expect(h.isTextual).to.equal(!isNum);

                if (isNum) {
                    expect(h.numericPrecision).to.be.at.least(0);

                    if (h.type !== 'double')
                        expect(h.numericScale).to.be.at.least(0);

                    expect(h.maxCharacters).to.be.null;
                    expect(h.charset).to.be.null;
                    expect(h.enumValues).to.be.null;
                } else if (type === 'textual') {
                    // Textual header
                    expect(h.numericPrecision).to.be.null;
                    expect(h.numericScale).to.be.null;

                    expect(h.maxCharacters).to.be.above(0);
                    expect(h.charset).to.not.be.null;
                } else {
                    // Enum header
                    if (type === 'enum') {
                        expect(Array.isArray(h.enumValues)).to.be.true;
                        expect(h.enumValues).to.have.length.above(0);
                    }
                }

                expect(h.nullable).to.be.a('boolean');
                expect(h.comment).to.equal(`${h.name} column`);
            };

            // See init.sql
            const textual = ['string'];
            const numerical = ['foo_pk', 'integer', 'double', 'boolean'];

            for (const h of textual) expectHeader(h, 'textual');
            for (const h of numerical) expectHeader(h, 'numerical');

            expect(findHeader('date').type).to.equal('date');
            expect(findHeader('time').type).to.equal('timestamp');
        });

        it('should return the total amount of rows', () =>
            request.basic(`/tables/${PRIMARY_TABLE}/meta`, 200, (meta: TableMeta) => {
                expect(meta.totalRows).to.be.a('number');
                // It's technically possible for a table to have 0 rows but with
                // we're assuming our test tables aren't empty
                expect(meta.totalRows).to.be.above(0);
            })
        );

        it('should return an array of Constraints', () => {
            return request.basic(`/tables/${PRIMARY_TABLE}/meta`, 200, (meta: TableMeta) => {
                expect(meta.constraints).to.exist;
                expect(meta.constraints).to.have.lengthOf(1 + SECONDARY_TABLES.length);

                // Should only be one primary key
                expect(_.find(meta.constraints, (c) => c.type === 'primary')!!.localColumn)
                    .to.equal(PRIMARY_TABLE + '_pk');

                // Validate foreign keys
                for (const secondaryTable of SECONDARY_TABLES) {
                    const constraint = _.find(meta.constraints, (c) => c.localColumn === secondaryTable)!!;
                    expect(constraint).to.exist;
                    expect(constraint.type).to.equal('foreign');
                    expect(constraint.foreignColumn).to.equal(secondaryTable + '_pk');
                }
            });
        });

        it('should 404 when given a non-existent table', () =>
            request.basic('/tables/foobar/meta', 404, (error: ErrorResponse) => {
                expect(error.input).to.deep.equal({ name: 'foobar' });
                expect(error.message).to.be.a('string');
            })
        );
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
