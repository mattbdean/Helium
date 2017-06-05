import { expect } from 'chai';
import { Application } from 'express';

import { ErrorResponse, SqlTableHeader } from '../src/common/responses';
import { fetchTableNames } from '../src/routes/api/v1/tables';
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

    describe('GET /api/v1/tables/:name/meta', () => {
        it('should return the table headers', async () => {
            const tableNames = await fetchTableNames();

            // Test up to 5 tables
            for (const tableName of tableNames.slice(Math.min(5, tableNames.length))) {
                // Make sure to URI-encode the table name because it could start
                // with '#', which supertest would strip before sending the request,
                // resulting in a request to '/api/v1/table/'
                await request.basic(`/tables/${encodeURIComponent(tableName)}/meta`, 200, (data: SqlTableHeader[]) => {
                    expect(Array.isArray(data)).to.be.true;

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
                                .to.equal(header.isTextual, `unexpected value for header '${header.name}' with type '${header.type}' at property '${varcharField}': ${header[varcharField]}`);
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
                });
            }
        });

        it('should 404 when given a non-existent table', () =>
            request.basic('/tables/foobar/meta', 404, (error: ErrorResponse) => {
                expect(error.input).to.deep.equal({ name: 'foobar' });
                expect(error.message).to.be.a('string');
            })
        );
    });
});

