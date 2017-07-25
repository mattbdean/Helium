import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as helmet from 'helmet';
import * as logger from 'morgan';
import * as path from 'path';

import { api } from './routes/api';
import { front } from './routes/front';

export function createServer(): express.Application {
    const app = express();
    app.use(logger('dev'));
    app.use(bodyParser.json());
    app.use(helmet());

    app.use('/api/v1', api());
    // Mount static assets before the front() module so we can still use our
    // assets without the front()'s wildcard route catching it first
    app.use(express.static(path.join(__dirname, 'public')));
    app.use('/', front());

    return app;
}
