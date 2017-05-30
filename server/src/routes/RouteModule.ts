import { Router } from 'express';

export interface RouteModule {
    router: Router;
    mountPoint: string;
}
