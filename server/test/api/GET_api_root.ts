import { RequestContext } from '../api.test.helper';
import { setupRequestContext } from './setup';

import { expect } from 'chai';

export default function() {
    let request: RequestContext;
    before(() => {
        request = setupRequestContext();
    });

    describe('GET /api/v1/*', () => {
        it('should 404 with JSON data', () =>
            request.basic('/foobar', 404, (error) => {
                expect(error.message).to.exist;
                expect(error.input).to.deep.equal({});
            })
        );
    });
}
