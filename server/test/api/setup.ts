import { createServer } from '../../src/server';
import { RequestContext } from '../api.test.helper';

export const setupRequestContext = () => {
    return new RequestContext(createServer({ api: true }));
};
