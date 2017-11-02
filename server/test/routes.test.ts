import * as request from 'supertest';
import { Helium } from '../src/helium';

describe('routes', () => {
    let app: Helium;

    before('create app', async () => {
        app = new Helium({ front: true });
        await app.start();
    });

    describe('GET /*', () => {
        // Let the Angular app show 404's
        it('should respond with HTML', async () => {
            const randomRoutes = ['/', '/table', '/foo'];
            for (const route of randomRoutes) {
                await request(app.express)
                        .get(route)
                        .expect(200)
                        .expect('Content-Type', /html/);
            }
        });

        it('should respond with 404 when the Accept header is not for HTML', () => {
            return request(app.express)
                .get('/foo')
                .accept('foo/bar')
                .expect(404)
                .expect('Content-Type', /text/);
        });
    });
});
