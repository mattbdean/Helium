import { AssertionError, expect } from 'chai';
import { Application } from 'express';

import { createServer } from '../src/server';

import { RequestContext } from './api.test.helper';

describe('API v1', () => {
    let app: Application;
    let request: RequestContext;

    before('create app', () => {
        app = createServer();
        request = new RequestContext(app);
    });

    describe('GET /api/v1/*', () => {
        it('should 404 with JSON data', () =>
            request.basic('/foobar', 404, (error) => {
                expect(error.message).to.exist;
                expect(error.input).to.deep.equal({});
            })
        );
    });

    describe('GET /api/v1/table', () => {
        it('should return an array of strings', () => {
            request.basic('/table', 200, (data: string[]) => {
                expect(Array.isArray(data)).to.be.true;
                for (const table of data) {
                    expect(table).to.be.a('string');
                }
            });
        });
    });
});

