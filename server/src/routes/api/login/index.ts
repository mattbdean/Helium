import { Request, Response, Router } from 'express';
import * as joi from 'joi';
import { ErrorResponse } from '../../../common/api';
import { ConnectionConf } from '../../../db/connection-conf';
import { DatabaseHelper } from '../../../db/database.helper';

export function loginRouter(db: DatabaseHelper): Router {
    const r = Router();

    r.post('/', async (req: Request, res: Response) => {
        // Object destructuring, get these properties from request body
        const { username, password, host, port: portRaw } = req.body;

        // Require at a bare minimum the username and password
        if (username === undefined || password === undefined) {
            const err: ErrorResponse = {
                message: 'username or password keys not provided in form body'
            };
            return res.status(400).json(err);
        }

        const port = validatePort(portRaw);
        if (typeof port === 'object') {
            // port is an ErrorResponse
            return res.status(400).json(port);
        }

        // Create a connection configuration from the request body
        const conf: ConnectionConf = {
            user: username,
            password,
            host,
            port
        };

        try {
            // Try to create a session
            const apiKey = await db.authenticate(conf);

            // Notify the consumer of the API key and its expiration
            return res
                .header('X-Session-Expiration', String(db.expiration(apiKey)))
                .json({ apiKey });
        } catch (_) {
            // We couldn't connect, most likely due to an invalid configuration,
            // return 400.
            const resp: ErrorResponse = {
                message: 'Unable to connect to ' + host + (port ? ':' + port : '')
            };
            return res.status(400).json(resp);
        }
    });

    return r;
}

const portSchema = joi.number()
    // The port is a signed 16-bit integer (0-65535)
    .min(0)
    .max(Math.pow(2, 16) - 1)
    .integer();

function validatePort(port: string | undefined): number | undefined | ErrorResponse {
    if (port === undefined)
        return undefined;
    
    const validationResult = portSchema.validate(port);
    if (validationResult.error) {
        return {
            message: 'Expecting port to be an integer from 0-65535',
            relevantInput: { port }
        };
    }

    return validationResult.value as any;
}
