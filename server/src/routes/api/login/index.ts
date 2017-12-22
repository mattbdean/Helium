import { NextFunction, Request, Response, Router } from 'express';
import { ErrorResponse } from '../../../../../client/app/common/responses';
import { ConnectionConf } from '../../../db/connection-conf.interface';
import { DatabaseHelper } from '../../../db/database.helper';

export function loginRouter(db: DatabaseHelper): Router {
    const r = Router();

    r.post('/', async (req: Request, res: Response, next: NextFunction) => {
        // Object destructuring, get these properties from request body
        const { username, password, host } = req.body;

        // Requre at a bare minimum the username and password
        if (username === undefined || password === undefined) {
            const err: ErrorResponse = {
                message: 'username or password keys not provided in form body',
                input: { username, password }
            };
            return res.status(400).json(err);
        }

        // Create a connection configuration from the request body
        const conf: ConnectionConf = {
            user: username,
            password,
            host
        };

        try {
            // Try to create a session
            const apiKey = await db.authenticate(conf);

            // Notify the consumer of the API key and its expiration
            return res
                .header('X-Session-Expiration', String(db.expiration(apiKey)))
                .json({ apiKey });
        } catch (_) {
            // We couldn't connect, most likely due to an invalid configuraiton,
            // return 400.
            const resp: ErrorResponse = {
                message: 'Unable to create a connection',
                input: {}
            };
            return res.status(400).json(resp);
        }
    });

    return r;
}
