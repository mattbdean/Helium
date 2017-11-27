import { RequestContext } from '../api.test.helper';
import { setupRequestContext } from './setup';

import * as joi from 'joi';

export default function() {
    describe('GET /api/v1/schemas', () => {
        let request: RequestContext;
        before(async () => {
            request = await setupRequestContext();
        });

        it('should list all available schema names', () => {
            return request.basic('/schemas', 200, (data: any) => {
                joi.assert(data, joi.array().min(1).items(joi.string()));
            });
        });
    });
}
