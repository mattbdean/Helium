import { expect } from 'chai';
import { NodeEnv } from '../src/env';

describe('NodeEnv', () => {
    describe('debug', () => {
        const fail = () => { throw new Error('should not see this error'); };

        it('should do nothing in prod mode', () => {
            new NodeEnv('prod').debug(fail);
            new NodeEnv('production').debug(fail);
        });

        it('should execute the function or log the data in non-prod mode', () => {
            for (const env of ['test', 'testing', 'dev', 'development', 'random']) {
                expect(() => new NodeEnv(env).debug(fail)).to.throw(Error);
            }
        });
    });
});
