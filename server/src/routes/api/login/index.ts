import { NextFunction, Request, Response, Router } from 'express';
import { PassportStatic } from 'passport';
import { ErrorResponse } from '../../../common/responses';

export function loginRouter(auth: PassportStatic): Router {
    const r = Router();

    r.post('/', (req: Request, res: Response, next: NextFunction) => {
        auth.authenticate('local', (err, user) => {
            // If authentication didn't succeed, user will be false
            if (user !== false) {
                req.logIn(user, () => {
                    res.status(200).json({ apiKey: user });
                });
            } else {
                const resp: ErrorResponse = {
                    message: 'Unable to create a connection',
                    input: {}
                };
                res.status(400).json(resp);
            }
        })(req, res, next);
    });

    return r;
}
