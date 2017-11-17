import * as bodyParser from 'body-parser';
import { Application } from 'express';
import * as express from 'express';
import * as helmet from 'helmet';
import * as logger from 'morgan';
import * as path from 'path';

import { ConfigurationResolver } from './db/configuration-resolver';
import { Database } from './db/database.helper';
import { ModuleConfig } from './module-config.interface';
import { api } from './routes/api/index';
import { front } from './routes/front';

export class Helium {
    private app: Application | null = null;
    private db: Database | null = null;

    public get express(): Application {
        if (this.app === null)
            throw new Error('Not start()\'d yet');
        return this.app;
    }

    public get database(): Database {
        if (this.db === null)
            throw new Error('Not start()\'d yet');
        return this.db;
    }

    public constructor(private modules: ModuleConfig | null = null,
                       private resolver: ConfigurationResolver | null = null) {}

    public async start(dbConfName: string | null = null) {
        const app = express();
        app.use(logger('dev'));
        app.use(bodyParser.json());
        app.use(helmet());

        if (this.modules === null || this.modules.api)
            if (dbConfName === null || this.resolver === null) {
                throw new Error('Failed to initialize the API module either ' +
                    'because no configuration name or no configuration ' +
                    'resolver was provided');
            } else {
                const db = new Database(this.resolver);
                await db.connect(dbConfName);
                app.use('/api/v1', api(db));
                this.db = db;
            }

        // Mount static assets before the front() module so we can still use our
        // assets without the front()'s wildcard route catching it first
        if (this.modules === null || this.modules.assets)
            app.use(express.static(path.join(__dirname, 'public')));

        if (this.modules === null || this.modules.front)
            app.use('/', front());

        this.app = app;
    }
}
