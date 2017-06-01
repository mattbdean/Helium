import { Request, Response, Router } from 'express';
import * as _ from 'lodash';

import { ErrorResponse } from '../../../common/responses';
import { Database } from '../../../Database';
import { RouteModule } from '../../RouteModule';

export function table(): RouteModule {
    const r = Router();
    const db = Database.get();

    r.get('/', async (req: Request, res: Response) => {
        try {
            // db.conn is a PromiseConnection that wraps a Connection. A
            // Connection has a property `config`
            const dbName = db.conn.connection.config.database;
            const result = await db.conn.execute(
                'SELECT table_name FROM INFORMATION_SCHEMA.tables WHERE TABLE_SCHEMA = ?',
                [dbName]
            );

            // Simplify the return structure to an array of strings
            res.json(_.map(result[0], (row: { table_name: string }) => row.table_name));
        } catch (err) {
            internalError(res, {
                message: 'Could not execute request',
                input: {}
            });
        }
    });

    const internalError = (res: Response, err: ErrorResponse) => {
        res.status(500).json(err);
    };

    return {
        router: r,
        mountPoint: '/table'
    };
}
