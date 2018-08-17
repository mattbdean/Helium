import { NextFunction, Request, Response } from 'express';
import { ErrorResponse } from '../../common/api';
import { DatabaseHelper } from '../../db/database.helper';

/**
 * Wraps a standard Express route handler. If the handler successfully
 * resolves to a value, that value is sent to the response as JSON. If the
 * handler rejects, that error is passed to the next error handling
 * middleware.
 *
 * @returns A function that can be passed directly to a routing method such
 * as `get` or `post`.
 */
export function wrap(handler: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
        handler(req, res, next)
            .then((data) => {
                res.json(data);
            })
            .catch((err) => {
                next(err);
            });
    };
}

/**
 * Routing callback "middleware" that only passes control to the next
 * callback if the request has an active session and that session has a
 * database associated with it.
 * 
 * To use:
 * 
 *     router.use(requireActiveSession(myDatabaseHelper));
 */
export function requireActiveSession(db: DatabaseHelper) {
    return (req: Request, res: Response, next: NextFunction) => {
        const apiKey = req.header('x-api-key');
        if (apiKey === undefined) {
            // Require an active session
            const resp: ErrorResponse = {
                message: 'Please specify an X-API-Key header with your API ' +
                    'key from POST /api/v1/login'
            };
            return res.status(401).json(resp);
        }

        if (!db.hasPool(apiKey)) {
            const resp: ErrorResponse = {
                message: 'No database connection associated with this session'
            };
            return res.status(401).json(resp);
        } else {
            // All good, set expiration header
            res.header('X-Session-Expiration', String(db.expiration(apiKey)));
            next();
        }
    };
}
