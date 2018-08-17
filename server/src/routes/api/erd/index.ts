import { Request, Router } from 'express';
import { Erd } from '../../../common/api';
import { DaoFactory } from '../../../db/dao.factory';
import { DatabaseHelper } from '../../../db/database.helper';
import { SchemaDao } from '../../../db/schema.dao';
import { requireActiveSession, wrap } from '../util';

export function erdRouter(db: DatabaseHelper, daoFactory: DaoFactory) {
    const r = Router();

    r.use(requireActiveSession(db));

    const daoFor = (req: Request): SchemaDao => daoFactory(db, req.header('x-api-key')!!);

    r.get('/', wrap(async (req: Request): Promise<Erd> =>
            daoFor(req).erd()));
    
    return r;
}
