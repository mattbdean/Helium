import { expect } from 'chai';
import * as _ from 'lodash';
import * as moment from 'moment';

import { SqlRow } from '../../src/common/api';
import { DATE_FORMAT, DATETIME_FORMAT } from '../../src/common/constants';
import { ErrorResponse, PaginatedResponse } from '../../src/common/responses';
import { TableDao } from '../../src/routes/api/tables.queries';
import { RequestContext } from '../api.test.helper';
import { setupRequestContext } from './setup';
import { BASE_SCHEMA, SHOWCASE_TABLE } from './shared';

const randomInt = () => Math.round((Math.random() * 10000000));

export default function() {
    let request: RequestContext;
    let tableDao: TableDao;
    before(async () => {
        request = await setupRequestContext();
        tableDao = new TableDao(request.app.database);
    });

    describe('PUT /api/v1/schemas/:schema/:table/data', () => {
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
                relPath: `/schemas/${BASE_SCHEMA}/${table}/data`,
                expectedStatus,
                data: createData(randomId),
                validate
            });
        };

        let lastPk: number;

        /** Returns some pseudo-random data that can be inserted into SHOWCASE_TABLE */
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

        /**
         * Tries to insert exactly one row into SHOWCASE_TABLE and fetch it
         * using the API
         */
        const insertAndRetrieve = async (data: SqlRow): Promise<SqlRow> => {
            await request.spec({
                method: 'PUT',
                relPath: `/schemas/${BASE_SCHEMA}/${SHOWCASE_TABLE}/data`,
                expectedStatus: 200,
                data: {
                    [SHOWCASE_TABLE]: [data]
                }
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

        it('should not allow the user to insert blob data', () => {
            const data = createSampleData();
            data.blob = 'foo';

            return request.spec({
                method: 'PUT',
                relPath: `/schemas/${BASE_SCHEMA}/${SHOWCASE_TABLE}/data`,
                expectedStatus: 400,
                data: {
                    [SHOWCASE_TABLE]: [data]
                },
                validate: (err: ErrorResponse) => {
                    expect(err.message).to.include('blob');
                }
            });
        });

        it('shouldn\'t allow specifying unknown columns', () => {
            return tryInsert('customer', 400, (randomId) => ({
                customer: [{
                    customer_id: randomId,
                    name: 'Joe Smith',
                    other: 42 // this column doesn't exist
                }]
            }), (error: ErrorResponse) => {
                expect(error.message).to.include('other');
            });
        });

        it('shouldn\'t allow the user to insert any data into a table with a non-null blob column', () => {
            return request.spec({
                method: 'PUT',
                relPath: `/schemas/${BASE_SCHEMA}/blob_test/data`,
                expectedStatus: 400,
                data: {
                    blob_test: [{
                        pk: randomInt(),
                        blob_nullable: null,
                        blob_not_null: 'hello'
                    }]
                },
                validate: (err: ErrorResponse) => {
                    expect(err.message).to.include('blob');
                }
            });
        });

        it('shouldn\'t allow the user to submit data to a table or schema that doesn\'t exist', async () => {
            await request.spec({
                method: 'PUT',
                relPath: `/schemas/${BASE_SCHEMA}/blablabla/data`,
                expectedStatus: 404,
                data: {}
            });

            await request.spec({
                method: 'PUT',
                relPath: `/schemas/blablabla/${SHOWCASE_TABLE}/data`,
                expectedStatus: 404,
                data: {}
            });
        });

        it('should support inserting part table data as well', async () => {
            const partIds = [randomInt(), randomInt()];

            await tryInsert('master', 200, (masterPk) => ({
                master: [{ pk: masterPk }],
                master__part: [
                    { part_pk: partIds[0], master: masterPk },
                    { part_pk: partIds[1], master: masterPk }
                ]
            }));

            // Query the part table and make sure both were inserted
            const content = await tableDao.content(BASE_SCHEMA, 'master__part', 1, 1000);

            for (const partId of partIds) {
                expect(_.find(content, (row) => row['part_pk'] === partId)).to.exist;
            }
        });

        it('should disallow specifically entering data into a part table', () => {
            return tryInsert('master__part', 400, (randomId) => ({
                master__part: [{
                    part_pk: randomId,
                    master: randomId + 1
                }]
            }), (error: ErrorResponse) => {
                expect(error.message).to.include('part table');
            });
        });

        it('should disallow entering part tables that don\'t reference the master table PK', () => {
            return tryInsert('master', 400, (masterPk) => ({
                master: [ { pk: masterPk }],
                master__part: [{ part_pk: randomInt(), master: randomInt() }]
            }));
        });
    });
}
