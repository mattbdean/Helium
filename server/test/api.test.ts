import { expect } from 'chai';
import { Application } from 'express';
import * as _ from 'lodash';
import { Response } from 'supertest';

import {
    ErrorResponse, PaginatedResponse, SqlRow,
    SqlTableHeader
} from '../src/common/responses';
import {
    fetchTableHeaders as queryFetchTableHeaders,
    fetchTableNames
} from '../src/routes/api/v1/tables';
import { createServer } from '../src/server';

import { RequestContext } from './api.test.helper';

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
                for (const table of data) {
                    expect(table).to.be.a('string');
                }
            });
        });
    });

    describe.only('GET /api/v1/tables/:name', () => {
        it('should return an array of SqlRows', () =>
            examineSeveralTables('query', async (tableName: string, headers: SqlTableHeader[]) =>
                request.basic(`/tables/${encodeURIComponent(tableName)}`, 200, (response: PaginatedResponse<SqlRow[]>) => {
                    expect(response.size).to.equal(response.data.length);
                    expect(response.size).to.be.above(0);
                    for (const row of response.data) {
                        expect(Object.keys(row)).to.have.lengthOf(headers.length);

                        for (const header of headers) {
                            expect(row[header.name]).to.exist;
                        }
                    }
                })
            )
        );

        it('should support sorting via query', () =>
            firstTable(async (name: string, headers: SqlTableHeader[]) => {
                const expectOrderedBy = (data: SqlRow[], property: string, order: 'asc' | 'desc') => {
                    // This could fail if we're dealing with date types since
                    // dates are serialized to strings, and those don't have the
                    // same natural order as Date objects
                    expect(data).to.deep.equal(_.orderBy(data, [property], [order]));
                };

                for (const header of headers) {
                    const doRequest = (sort: 'asc' | 'desc'): Promise<void> =>
                        request.spec({
                            method: 'GET',
                            relPath: `/tables/${encodeURIComponent(name)}`,
                            expectedStatus: 200,
                            // sort ascending with sort=name, descending with sort=-name
                            query: { sort: (sort === 'desc' ? '-' : '') + header.name },
                            validate: (response: PaginatedResponse<SqlRow[]>) => {
                                expect(response.data.length).to.be.above(0);
                                expectOrderedBy(response.data, header.name, sort);
                            }
                        });

                    // Test both ascending and descending
                    await doRequest('asc');
                    await doRequest('desc');
                }
            })
        );

        it('should throw a 400 when sorting by a column that doesn\t exist', async () => {
            const table = (await fetchTableNames())[0];
            return request.spec({
                method: 'GET',
                relPath: `/tables/${encodeURIComponent(table)}`,
                query: { sort: 'foobar' },
                expectedStatus: 400,
                validate: (err: ErrorResponse) => {
                    expect(err.input).to.deep.equal({ sort: 'foobar' });
                }
            });
        });
    });

    describe('GET /api/v1/tables/:name/meta', () => {
        it('should return the table headers', () =>
            examineSeveralTables('api', async (tableName: string, data: SqlTableHeader[]) => {
                expect(Array.isArray(data)).to.be.true;
                expect(data).to.have.length.above(0);

                // Keep a record of all the column names
                const existingNames: string[] = [];

                for (const header of data) {
                    // Make sure we don't have any duplicates
                    expect(existingNames.indexOf(header.name)).to.be.below(0);
                    existingNames.push(header.name);

                    for (const field of ['name', 'type', 'rawType']) {
                        expect(header[field]).to.be.a('string').with.length.above(0);
                    }

                    expect(header.ordinalPosition).to.be.at.least(1);

                    expect(header.nullable).to.be.a('boolean');

                    for (const varcharField of ['maxCharacters', 'charset']) {
                        expect(header[varcharField] !== null)
                            .to.equal(header.isTextual, `field = ${varcharField}, value = ${header[varcharField]}`);
                    }

                    for (const numberField of ['numericPrecision', 'numericScale']) {
                        expect(header[numberField] !== null)
                            .to.equal(header.isNumber,
                            `field = ${numberField}, value = ${header[numberField]}`);
                    }

                    if (header.type === 'enum') {
                        expect(Array.isArray(header.enumValues)).to.be.true;
                        for (const enumVal of header.enumValues!!) {
                            expect(enumVal).to.be.a('string');
                        }
                    }
                }
            })
        );

        it('should 404 when given a non-existent table', () =>
            request.basic('/tables/foobar/meta', 404, (error: ErrorResponse) => {
                expect(error.input).to.deep.equal({ name: 'foobar' });
                expect(error.message).to.be.a('string');
            })
        );
    });

    /**
     * Like examineSeveralTables, but just for the first table it finds
     */
    const firstTable = async (doWork: (name: string, headers: SqlTableHeader[]) => Promise<void>) => {
        const name = (await fetchTableNames())[0];
        const headers = await queryFetchTableHeaders(name);
        return doWork(name, headers);
    };

    /**
     * Fetches up to [maxTables] tables from the database and calls [doWork]
     * when that information is ready. Useful for ensuring that tests don't pass
     * simply because they haven't been exposed to enough variation yet.
     *
     * @param method If 'api', will fetch via supertest, otherwise with a direct
     *               query function.
     * @param doWork Does some work with the headers (get more data, make
     *               assertions, etc.)
     * @param maxTables The maximum amount of tables to do work on. Defaults to
     *                  Infinity (do work on all tables)
     * @return {Promise<void>}
     */
    const examineSeveralTables = async (method: 'api' | 'query',
                                        doWork: (name: string, headers: SqlTableHeader[]) => Promise<void>,
                                        maxTables = Infinity) => {
        const tableNames = await fetchTableNames();
        const usedTables = tableNames.slice(0, Math.min(maxTables, tableNames.length));

        if (usedTables.length === 0)
            throw new Error('Must examine at least 1 table');

        // Test up to 5 tables
        for (const tableName of usedTables) {
            await fetchTableHeaders(method, tableName).then((headers: SqlTableHeader[]) =>
                doWork(tableName, headers)
            );
        }
    };

    /**
     * Returns a Promise that resolves to the SqlTableHeaders for the given
     * table
     * @param method If 'api', will fetch via supertest, otherwise with a direct
     *               query function
     * @param tableName
     * @returns {Promise<SqlTableHeader>}
     */
    const fetchTableHeaders = (method: 'api' | 'query',
                               tableName: string): Promise<SqlTableHeader[]> => {

        let prom: Promise<SqlTableHeader[]>;
        if (method === 'api') {
            // Make sure to URI-encode the table name because it could start
            // with '#', which supertest would strip before sending the request,
            // resulting in a request to '/api/v1/table/'
            prom = request.basic(`/tables/${encodeURIComponent(tableName)}/meta`, 200)
                .then((res: Response) => res.body);
        } else {
            prom = queryFetchTableHeaders(tableName);
        }

        return prom;
    };
});

