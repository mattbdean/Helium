import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as helmet from 'helmet';
import * as logger from 'morgan';
import * as path from 'path';

import { api } from './routes/api';
import { front } from './routes/front';

/**
 * Enable or disable particular parts of the server. Specifying falsey value or
 * not providing one at all will disable that module. Providing a truthy value
 * will enable it. For example, to enable only the API and not the assets or
 * front-end routing, either one of these configurations will work:
 *
 *     { api: true }
 *     { api: true, assets: false, front: undefined }
 *     { api: 1,    assets: null,  front: 0 }
 */
export interface ModuleConfig {
    /** The JSON API mounted at /api/v1. Requires a database connection */
    api?: boolean;

    /** Non-API routes */
    front?: boolean;

    /** All front end assets, including client-side Angular code */
    assets?: boolean;
}

/**
 * Creates an Express application with the requested modules.
 *
 * @param modules A list of modules to enable. If null is given, all modules
 *                will be enabled.
 */
export function createServer(modules: ModuleConfig | null = null): express.Application {
    const app = express();
    app.use(logger('dev'));
    app.use(bodyParser.json());
    app.use(helmet());

    if (modules === null || modules.api)
        app.use('/api/v1', api());

    // Mount static assets before the front() module so we can still use our
    // assets without the front()'s wildcard route catching it first
    if (modules === null || modules.assets)
        app.use(express.static(path.join(__dirname, 'public')));

    if (modules === null || modules.front)
        app.use('/', front());

    return app;
}
