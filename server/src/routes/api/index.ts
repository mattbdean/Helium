import { Router } from 'express';

import { RouteModule } from '../RouteModule';
import { v1 } from './v1';

export function api(): Router {
    const router = Router();

    const modules: Array<() => RouteModule> = [
        v1
    ];

    for (const m of modules) {
        const mod = m();
        // data[0] is the mount point, data[1] is the Router
        router.use(mod.mountPoint, mod.router);
    }

    return router;
}
