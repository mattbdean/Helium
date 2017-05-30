import { Request, Response, Router } from 'express';

import { ErrorResponse } from '../../../common/responses';
import { RouteModule } from '../../RouteModule';

export function v1(): RouteModule {
    const router = Router();

    const modules: Array<() => RouteModule> = [
        // Put your RouteModules here
    ];

    for (const m of modules) {
        const mod = m();
        // Install each RouteModule at its requested relative path
        router.use(mod.mountPoint, mod.router);
    }

    // Catch all requests to the API not handled by an API module to ensure the
    // client still receives JSON data
    router.get('/*', (req: Request, res: Response) => {
        const resp: ErrorResponse = {
            message: 'Not found',
            input: {}
        };

        res.status(404).json(resp);
    });

    return {
        mountPoint: '/v1',
        router
    };
}
