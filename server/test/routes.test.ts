import { Application } from 'express';
import * as request from 'supertest';

import { createServer } from '../src/server';

describe('routes', () => {
    let app: Application;

    before('create app', async () => {
        app = createServer();
    });

    describe('GET /*', () => {
        // Let the Angular app show 404's
        it('should respond with HTML', async () => {
            const randomRoutes = ['/', '/table', '/foo'];
            for (const route of randomRoutes) {
                await request(app)
                        .get(route)
                        .expect(200)
                        .expect('Content-Type', /html/);
            }
        });
    });
});
