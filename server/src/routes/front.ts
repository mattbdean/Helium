import { Request, Response, Router } from 'express';
import * as path from 'path';
import { ErrorResponse } from '../common/responses';

export function front(): Router {
    const r = Router();
    r.get('*', (req: Request, res: Response) => {
        if (req.accepts('html')) {
            res.sendFile(path.join(__dirname, '../public/index.html'), (err: Error) => {
                if (err) {
                    return res.status(500)
                        .contentType('text/plain')
                        .send('The website hasn\'t been built or is currently being built');
                }
            });
        } else if (req.accepts('json')) {
            const resp: ErrorResponse = {
                message: 'Not found',
                input: {}
            };
            return res.status(404).json(resp);
        } else {
            return res.status(404).send('Please specify an Accept header');
        }
    });

    return r;
}
