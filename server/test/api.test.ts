import * as chai from 'chai';
import * as joi from 'joi';
import { pickBy } from 'lodash';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import * as supertest from 'supertest';
import { Response } from 'supertest';
import { Filter } from '../src/common/api';
import { QueryHelper } from '../src/db/query-helper';
import { Helium } from '../src/helium';
import { SchemaDao } from '../src/routes/api/schemas/schema.dao';
import { RequestContext } from './api.test.helper';

chai.use(sinonChai);
const expect = chai.expect;

////////////////////////////////////////////////////////////////////////////////
// This suite tests interactions between express API routes and Passport,
// DatabaseHelper, and SchemaDao. No actual database connections are required
// here. These tests only verify HTTP response codes and Content-Types. The
// actual data being returned is tested by SchemaDao's test suite.
////////////////////////////////////////////////////////////////////////////////

describe('API v1', () => {
    let app: Helium;
    let schemaDao: SchemaDao; // "fake" SchemaDao for testing purposes
    let request: RequestContext;

    // A Joi schema that mirrors the ErrorResponse interface
    const errorResponseSchema = joi.object({
        message: joi.string().required()
    });

    const MOCK_API_KEY = 'mockKey';

    beforeEach(async () => {
        app = new Helium();

        // Create a SchemaDao that can't actually do any querying
        schemaDao = new SchemaDao({} as any as QueryHelper);

        // Always return the testing SchemaDao when trying to access the DB
        await app.start(() => schemaDao);

        request = new RequestContext(app, MOCK_API_KEY);
    });

    describe('No/pre-authentication', () => {
        describe('GET /api/v1/*', () => {
            it('should 404 with JSON', () => {
                return supertest(app.express)
                    .get('/api/v1/foo')
                    .expect(404)
                    .expect('Content-Type', /application\/json/)
                    .then((req) => {
                        expect(req.body).to.deep.equal({ message: 'Not found' });
                    });
            });
        });

        describe('POST /api/v1/login', () => {
            const baseRequest = (conf: any) => {
                return supertest(app.express)
                    .post('/api/v1/login')
                    .expect('Content-Type', /application\/json/)
                    // Only send data that we actually provide
                    .send(pickBy({ username: conf.user, password: conf.password, host: conf.host },
                        (val) => val !== undefined));
            };

            it('should show session expiration', async () => {
                const conf = { user: 'user', password: 'password', host: 'localhost' };

                const key = 'testing-key';
                const authStub = sinon.stub(app.database, 'authenticate')
                    .withArgs(conf)
                    .resolves(key);

                // Random value, should be present in the response headers
                const expiration = 777;
                sinon.stub(app.database, 'expiration')
                    .withArgs(key)
                    .returns(expiration); 

                await baseRequest(conf)
                    .expect(200)
                    .expect('x-session-expiration', String(expiration))
                    .then((res: Response) => {
                        // The body should look be an object with a single
                        // property (apiKey)
                        joi.assert(res.body, joi.object({ apiKey: key }));
                    });

                // Make sure we're the server is trying to authenticate with the
                // proper credentials
                expect(authStub).to.have.been.calledWith(conf);
            });

            it('should 400 when the username, password, or host isn\'t provided', async () => {
                // If the username and password aren't present, Passport will
                // immediately 400
                await baseRequest({ user: undefined, password: 'password', host: 'localhost' })
                    .expect(400)
                    .then((res: Response) => {
                        joi.assert(res.body, errorResponseSchema);
                    });
                await baseRequest({ user: 'user', password: undefined, host: 'localhost'})
                    .expect(400)
                    .then((res: Response) => {
                        joi.assert(res.body, errorResponseSchema);
                    });

                // Specifying other properties (like the host) will make the server
                // attempt a DB connection
                const conf = { user: 'user', password: 'password', host: 'invalid_host' };
                const authStub = sinon.stub(app.database, 'authenticate')
                    .withArgs(conf)
                    .rejects('Error');

                await baseRequest(conf)
                    .expect(400);

                expect(authStub).to.have.been.calledWith(conf);
            });
        });
    });

    describe('Post-authentication', () => {
        beforeEach(async () => {
            // Bypass Passport authentication
            (app.database as any).pools.set(MOCK_API_KEY, { mockPool: true });

            // Make sure that the server thinks that there is an active
            // connection for the testing key. We don't actually use any DB
            // connections since we stub SchemaDao, so this is perfectly fine.
            sinon.stub(app.database, 'hasPool')
                .withArgs(MOCK_API_KEY)
                .returns(true);
        });

        // Creates an Error whose 'code' property is given
        const mysqlError = (code: string) => {
            const err: any = new Error();
            err.code = code;
            return err;
        };

        describe('GET /api/v1/schemas', () => {
            it('should list all schemas', async () => {
                const schemasStub = sinon.stub(schemaDao, 'schemas')
                    .resolves([]);

                await request.get('/schemas', 200);

                expect(schemasStub).to.have.been.calledOnce;
            });

            it('should throw a 500 when something goes wrong', async () => {
                const schemasSub = sinon.stub(schemaDao, 'schemas')
                    .rejects(Error);

                await request.get('/schemas', 500);

                expect(schemasSub).to.have.been.calledOnce;
            });
        });

        describe('GET /api/v1/schemas/:schema', () => {
            it('should respond with the tables in the schema on success', async () => {
                const tablesStub = sinon.stub(schemaDao, 'tables')
                    .resolves([]);

                await request.get('/schemas/foo', 200);

                expect(tablesStub).to.have.been.calledWithExactly('foo');
            });

            it('should 404 when the schema doesn\'t exist', async () => {
                const tablesStub = sinon.stub(schemaDao, 'tables')
                    .rejects(mysqlError('ER_DBACCESS_DENIED_ERROR'));

                await request.get('/schemas/foo', 404);

                expect(tablesStub).to.have.been.calledWithExactly('foo');
            });
        });

        describe('GET /api/v1/schemas/:schema/:table', () => {
            it('should respond with the table metadata on success', async () => {
                const metaStub = sinon.stub(schemaDao, 'meta')
                    .resolves({});

                await request.get('/schemas/foo/bar', 200);

                expect(metaStub).to.have.been.calledWithExactly('foo', 'bar');
            });

            it('should 404 when the schema or table doesn\'t exist', async () => {

                // Test what happens when the DB reports that a DB doesn't exist
                // or can't be accessed by the user
                let metaStub = sinon.stub(schemaDao, 'meta')
                    .rejects(mysqlError('ER_DBACCESS_DENIED_ERROR'));
                await request.get('/schemas/foo/bar', 404);
                expect(metaStub).to.have.been.calledWithExactly('foo', 'bar');
                metaStub.reset();

                // Test what happens if the schema exists but the table doesn't
                metaStub = metaStub.rejects(mysqlError('ER_NO_SUCH_TABLE'));
                await request.get('/schemas/baz/qux', 404);
                expect(metaStub).to.have.been.calledWithExactly('baz', 'qux');
            });
        });

        describe('GET /api/v1/schemas/:schema/:table/column/:col', () => {
            it('should 200 when :schema, :table, and :col all exist', async () => {
                const colStub = sinon.stub(schemaDao, 'columnContent')
                    .resolves([]);
                await request.get('/schemas/foo/bar/column/baz', 200);

                expect(colStub).to.have.been.calledWithExactly('foo', 'bar', 'baz');
            });

            it('should 400 when the schema, table, or column doesn\'t exist', async () => {
                let colStub = sinon.stub(schemaDao, 'columnContent');

                const assertCode = async (errorCode: string, httpCode: number) => {
                    // Reset any previous behavior/call history
                    colStub.reset();
                    // Make sure columnContent() always rejects with this code
                    colStub = colStub.rejects(mysqlError(errorCode));

                    // Call the endpoint, ensure 404
                    await request.get('/schemas/foo/bar/column/baz', httpCode);

                    // Make sure columnContent() was called
                    expect(colStub).calledWithExactly('foo', 'bar', 'baz');
                };

                await assertCode('ER_DBACCESS_DENIED_ERROR', 404); // bad schema
                await assertCode('ER_NO_SUCH_TABLE', 404); // bad table
                await assertCode('ER_BAD_FIELD_ERROR', 400); // bad column
            });
        });

        describe('GET /api/v1/schemas/:schema/:table/data', () => {
            const emptyResponse = () => ({ rows: [], count: 0 });
            it('should 200 when the schema and table both exist', async () => {
                const stub = sinon.stub(schemaDao, 'content')
                    .resolves(emptyResponse());

                await request.get('/schemas/foo/bar/data', 200);

                expect(stub).calledWithExactly('foo', 'bar',
                    { limit: 25, page: 1, sort: undefined }, []);
            });

            it('should 404 when either the schema or table don\'t exist', async () => {
                const stub = sinon.stub(schemaDao, 'content')
                    .rejects(mysqlError('ER_DBACCESS_DENIED_ERROR'));
                await request.get('/schemas/foo/bar/data', 404);
                stub.reset();

                stub.rejects(mysqlError('ER_NO_SUCH_TABLE'));
                await request.get('/schemas/foo/bar/data', 404);
            });

            it('should support the limit, sort, and page query params', async () => {
                const stub = sinon.stub(schemaDao, 'content')
                    .resolves(emptyResponse());
                await request.spec({
                    method: 'GET',
                    relPath: '/schemas/foo/bar/data',
                    expectedStatus: 200,
                    query: {
                        limit: '10',
                        page: '2',
                        sort: '-baz'
                    }
                });

                expect(stub).calledWithExactly('foo', 'bar',
                    { limit: 10, page: 2, sort: { by: 'baz', direction: 'desc' }}, []);
            });

            it('should 400 when the sorting column doesn\'t exist', async () => {
                sinon.stub(schemaDao, 'content')
                    .rejects(mysqlError('ER_BAD_FIELD_ERROR'));
                await request.get('/schemas/foo/bar/data', 400);
            });

            it('should handle filters', async () => {
                const stub = sinon.stub(schemaDao, 'content')
                    .resolves(emptyResponse());

                const filters: Filter[] = [
                    { param: 'col1', op: 'lt', value: '5' },
                    { param: 'col2', op: 'eq', value: '6' }
                ];

                await request.spec({
                    method: 'GET',
                    relPath: '/schemas/schema/table/data',
                    expectedStatus: 200,
                    query: {
                        filters: JSON.stringify(filters)
                    }
                });

                expect(stub).to.have.been.calledWithExactly(
                    'schema',
                    'table',
                    { limit: 25, page: 1, sort: undefined },
                    filters
                );
            });

            it('should 400 when given malformed filters', async () => {
                sinon.stub(schemaDao, 'content')
                    .rejects(new Error('content() should not have been called'));
                await request.spec({
                    method: 'GET',
                    relPath: '/schemas/schema/table/data',
                    expectedStatus: 400,
                    query: {
                        filters: '[ malformed JSON ]'
                    }
                });

                await request.spec({
                    method: 'GET',
                    relPath: '/schemas/schema/table/data',
                    expectedStatus: 400,
                    query: {
                        filters: '[{ "param": "foo", "op": "eq", "value": "bar", "unknown": true }]'
                    }
                });
            });

            it('should handle an empty array of filters', async () => {
                const stub = sinon.stub(schemaDao, 'content')
                    .resolves(emptyResponse());

                await request.spec({
                    method: 'GET',
                    relPath: '/schemas/schema/table/data',
                    expectedStatus: 200,
                    query: {
                        filters: '[]'
                    }
                });

                expect(stub).to.have.been.calledWithExactly('schema', 'table', {
                    page: 1, limit: 25, sort: undefined
                }, []);
            });
        });

        describe('PUT /api/v1/schemas/:schema/:table/data', () => {
            const data = { not: 'relevant when stubbing' };

            it('should 200 when the data was inserted successfully', async () => {
                const stub = sinon.stub(schemaDao, 'insertRow').resolves();
                await request.spec({
                    method: 'PUT',
                    relPath: '/schemas/foo/data',
                    expectedStatus: 200,
                    data
                });

                expect(stub).calledWithExactly('foo', data);
            });

            it('should 400 when the data was not inserted successfully', async () => {
                // Create a mock Joi error
                const error: any = new Error();
                error.isJoi = true;
                error.details = [{ message: 'test' }];

                const stub = sinon.stub(schemaDao, 'insertRow').rejects(error);
                await request.spec({
                    method: 'PUT',
                    relPath: '/schemas/foo/data',
                    expectedStatus: 400,
                    data
                });

                expect(stub).calledWithExactly('foo', data);
            });
        });

        describe('GET /api/v1/schemas/:schema/:table/pluck', async () => {
            it('should pass query parameters on as selectors to pluck()', async () => {
                const stub = sinon.stub(schemaDao, 'pluck').resolves({});
                const query = { k1: 'v1', k2: 'v2' };

                await request.spec({
                    method: 'GET',
                    relPath: '/schemas/foo/bar/pluck',
                    expectedStatus: 200,
                    query
                });

                expect(stub).to.have.been.calledWithExactly('foo', 'bar', query);
            });
        });
    });
});
