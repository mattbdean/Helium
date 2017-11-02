import { RequestContext } from '../api.test.helper';
import { setupRequestContext } from './setup';

import { expect } from 'chai';

export default function() {
    let request: RequestContext;
    before(() => {
        request = setupRequestContext();
    });

    describe('GET /api/v1/:name/column/:col', () => {
        it('should return distinct values for that column in ABC order', () => {
            return request.basic(`/tables/customer/column/customer_id`, 200, (data: any[]) => {
                expect(data).to.deep.equal([0, 1]);
            });
        });

        it('should 400 when given an invalid table name', () => {
            return request.basic('/tables/blablabla/column/bar', 400);
        });

        it('should 400 when given an invalid column name', () => {
            return request.basic('/tables/foo/column/blablabla', 400);
        });
    });
}
