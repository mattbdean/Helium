import { Request, Response, Router } from 'express';
import { ErrorResponse } from '../../common/api';
import { DaoFactory } from '../../db/dao.factory';
import { DatabaseHelper } from '../../db/database.helper';
import { NodeEnv } from '../../env';
import { erdRouter } from './erd';
import { loginRouter } from './login';
import { pingRouter } from './ping';
import { schemasRouter } from './schemas';

export function api(env: NodeEnv, db: DatabaseHelper, daoFactory: DaoFactory): Router {
    const router = Router();
    router.use('/schemas', schemasRouter(env, db, daoFactory));
    router.use('/login', loginRouter(db));
    router.use('/ping', pingRouter(db));
    router.use('/erd', erdRouter(db, daoFactory));

    // Catch all requests to the API not handled by an API module to ensure the
    // client still receives JSON data
    router.get('/*', (req: Request, res: Response) => {
        const resp: ErrorResponse = {
            message: 'Not found'
        };

        res.status(404).json(resp);
    });
    return router;
}
