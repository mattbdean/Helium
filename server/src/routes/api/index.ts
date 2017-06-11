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
        router.use(mod.mountPoint, mod.router);
    }

    return router;
}
