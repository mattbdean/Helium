import { Request, Response, Router } from 'express';

import { ErrorResponse } from '../../common/responses';
import { DatabaseHelper } from '../../db/database.helper';
import { DaoFactory } from './dao.factory';
import { loginRouter } from './login';
import { schemasRouter } from './schemas';

export function api(db: DatabaseHelper, daoFactory: DaoFactory): Router {
    const router = Router();
    router.use('/schemas', schemasRouter(db, daoFactory));
    router.use('/login', loginRouter(db));

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
