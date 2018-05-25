import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { range } from 'lodash';
import { Pool } from 'promise-mysql';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { ConnectionConf } from '../../src/db/connection-conf';
import { DatabaseHelper } from '../../src/db/database.helper';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const expect = chai.expect;

describe('DatabaseHelper', () => {
    // These tests might as well use Infinity as the max age, but we need a
    // finite number for DatabaseHelper.expiration() tests.
    const MAX_AGE = 60 * 60 * 1000; // 1 hour

    let helper: DatabaseHelper;

    const fakePool = (): Pool => ({
        getConnection: () => { throw new Error('getConnection() not stubbed'); },
        end: () => { throw new Error('end() not stubbed'); }
    }) as any as Pool;

    beforeEach(() => {
        helper = new DatabaseHelper(MAX_AGE);
    });

    describe('authenticate', () => {
        it('should attempt to make a connection with the database', async () => {
            expect(helper.size()).to.equal(0);
            const conf: ConnectionConf = { user: 'foo', password: 'bar' };

            const pool = fakePool();
            const getConnectionStub = sinon.stub(pool, 'getConnection')
                .returns({});
            const createPoolStub = sinon.stub((helper as any), 'createPool')
                .withArgs(conf)
                .returns(pool);

            await helper.authenticate(conf);

            expect(createPoolStub).to.have.been.calledWith(conf);
            expect(getConnectionStub).to.have.been.calledOnce;

            expect(helper.size()).to.equal(1);
        });

        it('should return an existing key if the pool already exists', async () => {
            const key = 'foo';

            // Stub createKey() so we can force the helper encountering a
            // duplicate key
            const createHashStub = sinon.stub(helper as any, 'createKey')
                .returns(key);

            // Insert data at the collision point
            (helper as any).pools.set(key, {});

            // Since createHash() returns `key`, we should expect that this
            // function will reject
            await expect(helper.authenticate({ user: 'bar', password: 'baz' }))
                .to.eventually.equal(key);

            expect(createHashStub).to.have.been.calledOnce;
        });
    });

    describe('queryHelper', () => {
        it('should return a new QueryHelper when the pool exists', () => {
            const key = 'foo';
            const pool = { fake: true };
            (helper as any).pools.set(key, pool);
            const queryHelper = helper.queryHelper(key);
            expect((queryHelper as any).pool).to.deep.equal(pool);
        });

        it('should throw an error if the pool doesn\'t exist', () => {
            expect(() => helper.queryHelper('unknown')).to.throw(Error);
        });
    });

    describe('hasPool', () => {
        it('should return true only if the pool is defined', () => {
            expect(helper.hasPool('foo')).to.be.false;

            (helper as any).pools.set('foo', {});
            expect(helper.hasPool('foo')).to.be.true;
        });
    });

    describe('close', () => {
        it('should close a connection and remove it from the registry', async () => {
            const key = 'foo';

            // Stub the end() method so that it always returns a resolved Promise
            const pool = fakePool();
            const endStub = sinon.stub(pool, 'end')
                .returns(Promise.resolve());

            (helper as any).pools.set(key, pool);
            await helper.close(key);
            expect(endStub).to.have.been.calledOnce;

            expect(helper.size()).to.equal(0);
        });

        it('should do nothing when there is no pool for that key', async () => {
            expect(helper.size()).to.equal(0);

            // Just make sure it doesn't fail
            await helper.close('foo');
        });
    });

    describe('closeAll', () => {
        it('should close all connections and remove them from the registry', async () => {
            // Set up X amount of fake pools like how we tested close()
            const stubs = range(5).map((i) => {
                const pool = fakePool();
                const endStub = sinon.stub(pool, 'end').returns(Promise.resolve());
                (helper as any).pools.set('conn' + i, pool);
                return endStub;
            });

            // Close all connection pools
            await helper.closeAll();

            // Assert that every end() on every pool was called
            for (const stub of stubs) {
                expect(stub).to.have.been.calledOnce;
            }

            // All keys should have been deleted from the registry
            expect(helper.size()).to.equal(0);
        });
    });

    describe('expiration', () => {
        it('should return a negative number when the key doesn\'t exist', () => {
            expect(helper.expiration('foo')).to.be.below(0);
        });

        it('should return the unix time', () => {
            const error = 5; // 5 milliseconds of error, pretty large tbh

            const key = 'mockKey';
            (helper as any).pools.set(key, {});

            const expiration = helper.expiration(key);
            const now = Date.now();
            expect(expiration).to.be.at.most(now + MAX_AGE).and.at.least(now + MAX_AGE - error);
        });
    });
});
