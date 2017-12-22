import { fail } from 'assert';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as joi from 'joi';
import { find, orderBy, random, uniq } from 'lodash';
import { Constraint } from '../src/common/api';
import { TableInsert } from '../src/common/table-insert.interface';
import { ConnectionConf } from '../src/db/connection-conf.interface';
import { DatabaseHelper } from '../src/db/database.helper';
import { SchemaDao, Sort } from '../src/routes/api/schemas/schema.dao';

chai.use(chaiAsPromised);
const expect = chai.expect;

////////////////////////////////////////////////////////////////////////////////
// This suite tests interactions between SchemaDao and a MySQL database
// connection. These tests assume that init.sql was run successfully
////////////////////////////////////////////////////////////////////////////////

describe('SchemaDao', () => {
    // INFORMATION_SCHEMA.COLUMNS is pretty much guaranteed to have 100+
    // records since it contains all the definitions for all the columns in
    // all schemas (including INFORMATION_SCHEMA). COLUMN_NAME is the column
    // with the most diverse data, so we'll use that for sorting.
    const db = 'INFORMATION_SCHEMA'; // Use 'db' b/c name clashes with Joi vars
    const table = 'COLUMNS';
    const sortingRow = 'COLUMN_NAME'; // Row with very unique data
    const contentsRow = 'TABLE_NAME'; // Row with somewhat unique data
    const numColumns = 21; // number of columns in the above table

    const dbHelper = new DatabaseHelper(Infinity);
    let connectionPoolKey: string;
    let dao: SchemaDao;

    before(async () => {
        const conf: ConnectionConf = { user: 'user', password: 'password' };
        connectionPoolKey = await dbHelper.authenticate(conf);
    });

    beforeEach(() => {
        dao = new SchemaDao(dbHelper.queryHelper(connectionPoolKey));
    });

    describe('schemas', () => {
        it('should return an array of schema names', async () => {
            joi.assert(await dao.schemas(), joi.array().items(joi.string()).min(1));
        });
    });

    describe('tables', () => {
        it('should return an array of table names when a schema exists', async () => {
            const schemaName = 'helium';
            const data = await dao.tables(schemaName);

            // The TableName constructor has its own tests, don't go into too
            // much detail here
            const schema = joi.array().items(joi.object({
                schema: schemaName, // should be exactly the value of 'db'
                rawName: joi.string(),
                tier: joi.string().regex(/lookup|manual|imported|computed|hidden/),
                cleanName: joi.string(),
                // Allow null or a string
                masterRawName: joi.alternatives(joi.string(), joi.only(null))
            }));

            joi.assert(data, schema);
        });

        it('should throw an Error when the schema doesn\'t exist', async () => {
            try {
                await dao.tables('unknown_schema');
                fail('Did not throw Error');
            } catch (ex) {
                expect(ex.code).to.equal('ER_DBACCESS_DENIED_ERROR');
            }
        });
    });

    describe('content', () => {
        // Each element in the array returned by content() should look like this
        const rowContents = joi.object().length(numColumns);

        it('should bring back 25 records by default', async () => {
            const data = await dao.content(db, table);
            const schema = joi.array().items(rowContents).length(25);
            joi.assert(data, schema);
        });

        it('should sort by a given column when requested', async () => {
            // Request that we sort some row (defined above) in a particular
            // direction
            const sort: Sort = { by: sortingRow, direction: 'asc'};
            const data = await dao.content(db, table, { sort });

            // Make sure we're still returning 25 elements by default
            joi.assert(data, joi.array().items(rowContents).length(25));

            // Sort the returned data with lodash and ensure it matches what was
            // returned from the database
            const sorted = orderBy(data, sortingRow, sort.direction);
            expect(sorted).to.deep.equal(data);
        });

        it('should request different data when passed a different page', async () => {
            // Request the first 2 pages
            const [page1, page2] = await Promise.all(
                [1, 2].map((page) => dao.content(db, table, { page }))
            );
            expect(page1).to.not.deep.equal(page2);
        });

        it('should throw an error given an invalid page', async () => {
            for (const pageNum of [-1, 0, 10000]) {
                await expect(dao.content(db, table, { page: pageNum })).to.eventually
                    .be.rejectedWith(Error);
            }
        });

        it('should only allow limits >= 0', async () => {
            for (const limit of [-2, -1]) {
                await expect(dao.content(db, table, { limit })).to.eventually
                    .be.rejectedWith(Error);
            }

            // Choose limits that are explicitly under the usual amount of
            // records in the chosen table
            for (const limit of [0, 1, 10, 100]) {
                const schema = joi.array().items(rowContents).length(limit);
                joi.assert(await dao.content(db, table, { limit }), schema);
            }
        });
    });

    describe('meta', () => {
        it('should return a TableMeta object with fully resolved constraints', async () => {
            const schemaName = 'helium';
            const tableName = 'shipment';
            const cols = 6;
            // Technically there's only 2 constraints but Helium doesn't
            // recognize compound keys yet
            const numConstraints = 5;
            const data = await dao.meta(schemaName, tableName);

            // Very basic schema to make sure we have the basics down
            const schema = joi.object({
                schema: joi.only(schemaName),
                name: joi.only(tableName),
                headers: joi.array().length(cols),
                totalRows: joi.number().integer().min(0),
                constraints: joi.array().length(numConstraints),
                comment: joi.string().allow(''),
                parts: joi.array().length(0)
            }).requiredKeys('schema', 'name', 'headers', 'totalRows', 'constraints', 'comment', 'parts');

            joi.assert(data, schema);

        });

        it('should include TableNames for part tables when applicable', async () => {
            // helium.master has 2 part tables
            expect((await dao.meta('helium', 'master')).parts).to.have.lengthOf(2);
            // helium.master__part is a part table
            expect((await dao.meta('helium', 'master__part')).parts).to.have.lengthOf(0);
        });

        it('should throw an Error when the schema doesn\'t exist', async () => {
            const error = await expect(dao.meta('unknown_schema', 'irrelevant'))
                .to.eventually.be.rejected;
            expect(error.code).to.equal('ER_DBACCESS_DENIED_ERROR');
        });
        it('should throw an Error when the table doesn\'t exist', async () => {
            const error = await expect(dao.meta('helium', 'unknown_table')).to.eventually.be.rejected;
            expect(error.code).to.equal('ER_NO_SUCH_TABLE');
        });
    });

    describe('resolveConstraints', () => {
        it('should resolve reference chains within the same schema', async () => {
            const constraints = (await dao.meta('helium', 'shipment')).constraints;
            const resolved = await dao.resolveConstraints(constraints);

            // In the actual schema:
            // 1. shipment.product_id ==>   order.product_id
            // 2.    order.product_id ==> product.product_id
            //
            // We expect to see:
            // 1. shipment.product_id ==> product.product_id

            expect(resolved).to.deep.include({
                type: 'foreign',
                localColumn: 'product_id',
                ref: {
                    schema: 'helium',
                    table: 'product',
                    column: 'product_id'
                }
            });
        });

        it('should resolve reference chains that involve more than one schema', async () => {
            const constraints = (await dao.meta('helium2', 'cross_schema_ref_test')).constraints;
            const resolved = await dao.resolveConstraints(constraints);

            // In the actual schema:
            // 1. helium2.cross_schema_ref_test.fk ==> helium.order.customer_id
            // 2.         helium.order.customer_id ==> helium.customer.customer_id
            //
            // We expect to see:
            // 1. helium2.cross_schema_ref_test.fk ==> helium.customer.customer_id

            expect(resolved).to.deep.include({
                type: 'foreign',
                localColumn: 'fk',
                ref: {
                    schema: 'helium',
                    table: 'customer',
                    column: 'customer_id'
                }
            });
        });
    });

    describe('columnContent', () => {
        it('should return all unique values for a specific column', async () => {
            const data = await dao.columnContent(db, table, contentsRow);

            // Make sure we're only being returned unique data
            expect(uniq(data)).to.deep.equal(data);
        });

        it('should throw an Error if the schema doesn\'t exist', async () => {
            try {
                await dao.columnContent('unknown_schema', table, contentsRow);
                fail('Should have thrown an Error');
            } catch (ex) {
                expect(ex.code).to.equal('ER_TABLEACCESS_DENIED_ERROR');
            }
        });

        it('should throw an Error if the table doesn\'t exist', async () => {
            const error = await expect(dao.columnContent(db, 'unknown_table', contentsRow))
                .to.eventually.be.rejected;
            expect(error.code).to.equal('ER_UNKNOWN_TABLE');
        });

        it('should throw an Error if the column doesn\'t exist', async () => {
            const error = await expect(dao.columnContent(db, table, 'unknown_row'))
                .to.eventually.be.rejected;
            expect(error.code).to.equal('ER_BAD_FIELD_ERROR');
        });
    });

    describe('insertRow', () => {
        // The TableInputValidator class tests handle validation testing

        const count = (schemaName: string, tableName: string) =>
            dao.meta(schemaName, tableName).then((meta) => meta.totalRows);

        it('should insert data into the given table', async () => {
            const before = await count('helium', 'customer');
            const data: TableInsert = {
                customer: [{
                    customer_id: random(100000),
                    name: 'test name'
                }]
            };
            await dao.insertRow('helium', data);
            const after = await count('helium', 'customer');

            expect(after).to.equal(before + 1);
        });

        it('should insert all data if the main table is a master table', async () => {
            const getCounts = (schemaName, tableNames: string[]) =>
                Promise.all(tableNames.map((tableName) => count(schemaName, tableName)));

            // Keep track of the total number of rows of each table before
            // inserting
            const before = await getCounts('helium', ['master', 'master__part']);

            // Create some random data here
            const randInt = () => random(10000000);
            const masterPk = randInt();

            const data: TableInsert = {
                master: [{
                    pk: masterPk
                }],
                master__part: [
                    { part_pk: randInt(), master: masterPk },
                    { part_pk: randInt(), master: masterPk }
                ]
            };

            // Insert that data
            await dao.insertRow('helium', data);

            // Make sure the new total number of rows is correct
            const after = await getCounts('helium', ['master', 'master__part']);

            // Inserted 1 rows into master
            expect(after[0]).to.equal(before[0] + 1);
            // Inserted 2 rows into master__part
            expect(after[1]).to.equal(before[1] + 2);
        });
    });

    describe('headers', () => {
        it('should return a TableHeader object for each column in the schema', async () => {
            // Very basic for now
            const data = await dao.headers(db, table);
            joi.assert(data, joi.array().items(joi.object()).length(numColumns));
        });
    });
});
