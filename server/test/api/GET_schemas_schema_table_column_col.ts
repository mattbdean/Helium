import { RequestContext } from '../api.test.helper';
import { setupRequestContext } from './setup';
import { BASE_SCHEMA } from './shared';

import { expect } from 'chai';

export default function() {
    let request: RequestContext;
    before(async () => {
        request = await setupRequestContext();
    });

    const columnPath = (table: string, column: string) =>
        `/schemas/${BASE_SCHEMA}/${table}/column/${column}`;

    describe('GET /api/v1/schemas/:schema/:table/column/:col', () => {
        it('should return distinct values for that column in ABC order', () => {
            return request.basic(columnPath('customer', 'customer_id'), 200, (data: any[]) => {
                expect(data).to.deep.equal([0, 1]);
            });
        });

        it('should 400 when given an invalid table name', () => {
            return request.basic(columnPath('blablabla', 'bar'), 400);
        });

        it('should 400 when given an invalid column name', () => {
            return request.basic(columnPath('customer', 'blablabla'), 400);
        });
    });
}
