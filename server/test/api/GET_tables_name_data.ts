import { expect } from 'chai';
import * as _ from 'lodash';

import { SqlRow, TableHeader, TableMeta } from '../../src/common/api';
import { BLOB_STRING_REPRESENTATION } from '../../src/common/constants';
import { ErrorResponse, PaginatedResponse } from '../../src/common/responses';
import { TableDao } from '../../src/routes/api/tables.queries';
import { RequestContext } from '../api.test.helper';
import { setupRequestContext } from './setup';
import { SHOWCASE_TABLE } from './shared';

export default function() {
    let request: RequestContext;
    before(() => {
        request = setupRequestContext();
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
}
