import { Request, Response, Router } from 'express';

import { ErrorResponse } from '../../common/responses';
import { Database } from '../../db/database.helper';
import { tables } from './tables';

export function api(db: Database): Router {
    const router = Router();
    router.use('/tables', tables(db));

    // Catch all requests to the API not handled by an API module to ensure the
    // client still receives JSON data
    router.get('/*', (req: Request, res: Response) => {
        const resp: ErrorResponse = {
            message: 'Not found',
            input: {}
        };

        res.status(404).json(resp);
    });
    return router;
}
